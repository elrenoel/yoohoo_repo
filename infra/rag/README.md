# PDF to selected flashcards and quiz

Scope: upload, chunking, keyword extraction, keyword selection, then RAG generation
of flashcards and quiz. Embedding dedupe remains deferred.

## Architecture

`/app` -> authenticated presign -> browser PUT PDF -> authenticated confirm ->
commit document -> PUT `ready/<documentId>.json` -> S3 ObjectCreated -> orchestrator
-> Step Functions Map (1 keyword worker, bounded to respect Gemini free-tier rate limits) -> workers -> finalizer -> batched core-keyword classifier -> polling/selection UI
-> generation Map (one keyword batch at a time, three-second spacing) -> atomic publish -> flashcards -> quiz.

The confirmation marker is deliberate: a PDF ObjectCreated notification may arrive
before `/confirm` commits. Workers must never process unconfirmed browser uploads.
Only the backend IAM principal can write `ready/*`. Confirm can be retried to
republish a marker; deterministic execution names and DB locks make replay safe.
PDF uploads use signed `If-None-Match: *` so a presigned URL cannot overwrite an
object after it has been validated. The signed length must match the browser Blob.

## Files and triggers

| Handler | Trigger | Timeout | Environment |
| --- | --- | --- | --- |
| `lambdas/orchestrator.ts` | ObjectCreated on `ready/*.json` | 900s | `SUPABASE_DATABASE_URL`, `RAG_BUCKET_NAME`, `RAG_STATE_MACHINE_ARN`, `RAG_CHUNK_PAGES` |
| `lambdas/worker.ts` | Step Functions per chunk/core classification | 300s | `SUPABASE_DATABASE_URL`, `RAG_BUCKET_NAME`, `GEMINI_API_KEY`, `GEMINI_MODEL` |
| `lambdas/finalizer.ts` | Map completion, skipped worker, failed orchestrator, terminal workflow failure | 60s | `SUPABASE_DATABASE_URL`, `RAG_BUCKET_NAME` |

`AWS_REGION` and temporary credentials are supplied by Lambda automatically.
The Next.js backend needs `AWS_REGION`, `RAG_BUCKET_NAME`, AWS role/profile
credentials and its existing Better Auth + database variables. Secrets are never
sent to the browser. Optional `SUPABASE_DATABASE_CA` enables verified TLS; without
it the database uses TLS require mode, consistent with the existing Better Auth
pool (encrypted but without certificate verification). Download the project CA
from Supabase Database Settings and supply it to both Next.js and Lambda for
verified TLS. The template has an optional PEM parameter for this public CA.

The pipeline uses raw parameterized SQL via postgres.js, `prepare:false` for
transaction-pooler compatibility, max two connections per execution environment.
Existing non-RAG endpoints still use supabase-js; this does not migrate the whole app.
`documents.user_id` remains Better Auth text IDs, referencing `public.user`.
RLS remains default-deny for clients. Server connections must have table privileges
and BYPASSRLS. Every API read/write checks ownership from the validated session.
Workers also join the document owner, status and soft-delete state.

After finalization, the workflow invokes the worker in `classify-core` mode. It
classifies uncached keywords in batches, stores topic/type/importance reasoning,
and recomputes proportional top-K core items without touching rows manually
overridden by a user. Classification failure is non-terminal: extracted keywords
remain ready and can be retried with `POST /api/decks/:id/classify-core` or
`npm run rag:backfill-core-keywords -- --deck-id=<uuid>`.

## Database

The preceding schema task created `documents` metadata, `document_chunks`,
`candidate_keywords`, RLS and grants. Run `schema.sql` against that database before
deploying this runtime; it adds scan-page numbers, completion/error tracking and
a unique `(document_id, chunk_index)` index. This is raw SQL, not an ORM migration.
It has already been applied to the connected project during implementation.
S3 metadata remains nullable for legacy rows; confirm always supplies real values.

`20260925100355_selected_rag_generation.sql` adds default-deny generation job
tables and private transaction functions. `20260925160254_generation_keyword_batches.sql`
changes each generation item into an ordered batch of at most ten selected keyword
IDs. A job reserves quota and snapshots the selected IDs; each worker fetches the
source chunk associated with every keyword in its batch, sends one Gemini request,
and stages only valid returned flashcards until every batch succeeds.
`20260925161423_representative_generation_quiz.sql` then makes the finalizer send
one additional Gemini request from the staged term/definition pairs. It creates
`clamp(round(selected_keywords / 3), 5, 20)` representative questions for the
whole deck rather than one question per keyword.

## AWS deployment

The dev environment is deployed in `ap-southeast-2` because the account SCP
denies CloudFormation in the other enabled Regions. Active stacks:

- `yoohoo-rag-bootstrap`: private build-source bucket, immutable ECR repository,
  bounded CodeBuild project and 30-day build logs.
- `yoohoo-rag-dev`: document bucket, three Lambda functions, Step Functions,
  EventBridge failure handling, IAM roles/policy, logs and failure alarm.

The deployed frontend origin is `http://localhost:3000`; `ArchiveMode` is
`Inactive90`. Local development uses the short-lived AWS CLI profile
`yoohoo-rag`, configured in `.env.local`. Production hosting must use workload
identity/federation and attach the output `BackendUploadPolicyArn` to that runtime.

1. Store JSON secrets in Secrets Manager: one with `SUPABASE_DATABASE_URL`, one
   with `GEMINI_API_KEY`. Supply their names as template parameters. CloudFormation
   resolves them into encrypted Lambda environment variables at deployment time;
   secret rotation requires refreshing the Lambda configuration.
2. Choose an exact frontend origin and a short lowercase stack name, e.g.
   `yoohoo-rag-dev`. Keep it <=20 characters so the deterministic bucket name fits.
3. Choose `ArchiveMode` explicitly. `Age60` transitions PDFs to Glacier 60 days
   after creation; **not** last access. `Inactive90` uses Intelligent-Tiering and
   archives after 90 days without access. AWS does not support native Glacier
   archiving after exactly 60 idle days. Archived source PDFs need restoring before
   reprocessing. No versioning is enabled, per the requested design.
4. With local Docker and SAM available, validate, build and deploy from the
   repository root:

```sh
sam validate --lint --template-file infra/rag/template.json
sam build --template-file infra/rag/template.json
sam deploy --guided --resolve-image-repos --capabilities CAPABILITY_IAM
```

The Docker image uses Lambda Node.js 22 x86_64 and builds native canvas dependencies
on Linux. Windows-generated native node_modules must not be copied into Lambda.
`npm run rag:build` checks JS bundles locally but is not a substitute for the image build.

When local Docker/SAM is unavailable, deploy `bootstrap-template.json`, upload a
sanitized source archive to its `source/rag-source.zip` object, and run the
CodeBuild output project. Package the immutable image digest for CloudFormation:

```sh
npm run rag:package -- --image-uri=<account>.dkr.ecr.<region>.amazonaws.com/<repo>@sha256:<digest>
```

This writes `build/rag-packaged-template.json`, injects the same immutable image
into all three functions, and inlines the state-machine definition. The current
dev image was built by CodeBuild and deployed by digest. Account Lambda concurrency
is limited to 10, so per-function reserved concurrency is omitted; Step Functions
still bounds worker fan-out at 10.

Attach the output `BackendUploadPolicyArn` to the trusted backend's IAM role;
set `RAG_BUCKET_NAME` to the bucket output. No user/access key is created by the
template. For a Vercel backend, configure an appropriate AWS credential federation
or deployment secret through the platform; browser clients receive signed URLs only.
Only one CORS origin is configured per stack; use a dev stack for localhost.

The IAM policies use exact AWS actions and stack-specific resources. The suffix
`/*` in S3 object ARNs and `log-stream:*` restricts access to that bucket prefix/log
group; no Allow statement uses `Resource: "*"` or administrator actions. TLS bucket
denial uses `Principal: "*"` so it applies to all principals (it grants no access).
S3 and logs are retained on stack removal. CloudWatch execution history/alarm and
30-day Lambda logs support diagnosis. Connect alarm actions to your notification
channel before production. EventBridge marks failed/timed-out executions in DB;
monitor finalizer errors as well because a DB outage can prevent recording failure.

## API

- `POST /api/documents/presign`: `{ filename, contentType: "application/pdf", fileSize }`
  -> `{ documentId, uploadUrl, headers, expiresIn: 300 }`.
- PUT the original File/Blob to `uploadUrl` with the returned headers.
- `POST /api/documents/confirm`: `{ documentId, filename, title? }` -> 202.
  The backend reconstructs the user-scoped key, reads S3 size/header and ignores
  client-supplied storage paths, owner IDs or file sizes.
- `GET /api/documents/:id/keywords`: document status, page count, chunk progress,
  partial-failure warning and keywords after finalization. Owner only; trash is 404.
- `PATCH /api/documents/:id/keywords`: `{ selectedIds: string[] }`. Replaces selection
  transactionally, rejects foreign-document keyword IDs, requires ready status.
- `POST /api/documents/:id/generate`: reserves daily quota atomically, creates or
  resumes an idempotent background job and starts the generation workflow.
- `GET /api/documents/:id/generate?jobId=...`: owner-only generation progress.
  Completed jobs redirect the UI to flashcards; quiz remains the next study step.

## Limits and failures

- 100 MiB PDF, 5 pages/chunk with a two-paragraph overlap by default (configurable
  5–10 pages), max 6,000 pages. Before worker fan-out, the orchestrator builds a
  server-only overview from the early pages and detected table-of-contents pages;
  each worker reads that overview from `documents.document_summary`.
  Text is never cut to 8,000 words. Oversized page count fails explicitly.
- Fewer than 20 words on a page triggers scan rendering, including single-page PDFs.
  This is a heuristic, not proof that a page is scanned. PNGs are rendered at 1400px
  width with a 12 MiB chunk image budget; failures are reported as skipped chunks.
- Gemini model env override, then the existing three-tier fallback, 500ms between
  models. Selected-material generation batches at most ten keywords, runs batches
  sequentially with a three-second interval, and retries a Gemini 429 up to three
  times using exponential backoff (about 2s, 4s, then 8s plus jitter). Per-attempt
  timeout is 65s. Invalid individual flashcards are logged and skipped without
  discarding other valid items in the same batch. Once all flashcard batches finish,
  the finalizer requests one exact-size, representative quiz from the complete deck;
  invalid quiz payloads fail the job before any deck content is published. No
  embeddings in this stage.
- Invalid AI output / exhausted fallback skips that chunk. DB errors propagate to
  Step Functions retry. Lambda timeout after retries is recorded as a skipped chunk.
- Dedupe uses JavaScript trim + lowercase and keeps the first deterministic row.
  Partial success becomes ready with a warning. No usable keywords becomes failed.
- Inline Map uses only UUIDs, not text/images, in payload/history. Keyword extraction
  uses one worker to avoid Gemini quota bursts. Exceptionally
  retry-heavy runs may exhaust Standard's 25,000-event history limit; the failure
  listener marks the document failed. For sustained very large workloads move to
  Distributed Map before raising the page cap.
- Selected-material generation uses the existing five-per-day quota. The document
  row lock plus quota transaction prevents parallel requests from exceeding it.
- Abandoned uploads are private and follow the selected archive lifecycle; automatic
  deletion of S3 files on database trash/permanent delete is not implemented here.

## Verification and one-document example

```sh
npm run rag:test
npm run rag:build
npm run typecheck
npm run build
npm run rag:smoke -- --local-ai
npm run rag:smoke -- --local-ai --vision
npm run rag:aws:e2e
```

Observed local PDF + real Gemini run: 1 page, 1 chunk, 5 keywords: Virtual memory,
Paging, Page fault, Page tables, Translation lookaside buffer. This confirms the
PDF/AI portion by itself.
The rendered-page vision variant also returned five keywords successfully.

Observed AWS end-to-end run: a synthetic 1-page PDF traveled through S3,
orchestrator Lambda, Step Functions, worker Lambda, Gemini, finalizer Lambda and
Supabase; it completed as `ready_for_selection` with 1 chunk and 5 keywords.
The test then removed only its generated database user/document and S3 objects.

Live DB integration (PowerShell):

```powershell
$env:RAG_DB_TEST = '1'
npx.cmd tsx --test scripts/rag-db.test.ts
```

It creates a uniquely identified test user/document, verifies owner isolation,
duplicate orchestration/worker replay, scan JSON, dedupe, incomplete-finalization
rejection and all-chunks-failed behavior, then deletes only its
own fixture. No real user's data or quota is modified.
The live integration test passed against the connected Supabase project.

TypeScript, production build, the eight RAG tests, and the existing automated
test suite passed. Full-project lint still reports six existing errors outside
the new pipeline; targeted lint for the new pipeline passed.

After deployment, sign in as a dedicated test user and put the request's Better
Auth Cookie header in `RAG_TEST_SESSION_COOKIE` locally (never share/log it):

```sh
npm run dev
# In another terminal, with RAG_TEST_SESSION_COOKIE set:
npm run rag:smoke
# Or use an actual small PDF:
npm run rag:smoke -- --pdf=sample-materials/example.pdf
```

This creates a PDF fixture, calls presign, uploads to S3, confirms, polls through
Lambda/Step Functions completion, selects two keywords and verifies persistence.
The resulting test document is intentionally left visible for inspection.

Deployment verification completed for the dev stacks: CloudFormation service
validation, Early Validation, CodeBuild container build, active Lambda checks,
private/encrypted S3 checks, active Standard workflow, local SDK access, and the
synthetic AWS end-to-end run all passed. `cfn-lint` and `cfn-guard` were unavailable,
so those two local validation layers were not run. No custom CloudTrail trail exists
in this account, which reduces audit retention beyond the service's event history.
The browser/API-cookie smoke path remains optional and has not been run; it covers
Better Auth plus presign/confirm endpoints in addition to the already verified AWS
processing path.
