# Yoohoo

> **AI-powered active recall platform.** Upload a PDF, pick the keywords extracted by the RAG pipeline, generate flashcards and quizzes, study, then review your score. Share your decks with a learning community.

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" />
  <img src="https://img.shields.io/badge/Gemini-AI-4285F4?logo=google" />
  <img src="https://img.shields.io/badge/PostgreSQL-Supabase-3FCF8E?logo=supabase" />
  <img src="https://img.shields.io/badge/AWS-Lambda%20%2B%20Step%20Functions-FF9900?logo=amazonaws" />
  <img src="https://img.shields.io/badge/License-MIT-green" />
</p>

---

## What is Yoohoo?

Yoohoo replaces **passive reading** with **active recall**. It turns lecture PDFs, e-books, and study notes into flashcards for concept review and quizzes for self-assessment.

On top of the study tools sits a social layer: users can share decks, write posts, follow each other, like, repost, bookmark, and discover material through Explore.

### Core loop

```
Upload PDF --> Extract material --> Select keywords --> Generate flashcards & quiz --> Study --> Score & review
```

---

## Features

### Learning

- **PDF upload up to 100 MiB** through a presigned URL straight to private S3.
- **Asynchronous processing** of long PDFs (chunking, keyword extraction) in the background.
- **RAG-based keyword extraction**, with a keyword selection step before anything is generated.
- **Flashcard and quiz generation** with Google Gemini, saved atomically.
- **Interactive flashcards**: flip animation, keyboard navigation (Space / arrow keys), progress counter.
- **Quiz system**: multiple choice, multiple question sets per document, time attack, score, and per-question answer review.
- **Attempt history** with detailed results for every quiz attempt.
- **Content language selector**: Auto (match the PDF), Bahasa Indonesia, or English.

### Decks and sharing

- Deck and document management on **Your Desk**.
- **Publish / unpublish** decks and **fork** public decks.
- **Trash** with restore and permanent delete (auto-cleanup after 30 days).
- **Trial mode** without login (results kept in `localStorage`, can be saved after sign-up).

### Social

- Home feed with posts and public decks.
- Like, repost, bookmark, comment, follow, and notifications.
- Explore by content, users, and topic tags.
- Public profiles with follower / following lists.
- Posts support Markdown, GFM, and KaTeX math.

### Platform

- Email/password and Google OAuth sign-in.
- Bahasa Indonesia and English UI.
- Dark-only interface built on semantic color tokens.
- Daily generation limit: **5 generations per user per day**.

---

## App Navigation

| Item                | Purpose                                |
| ------------------- | -------------------------------------- |
| **Home**            | Social feed                            |
| **Explore**         | Search decks, posts, users, and topics |
| **Your Desk**       | Personal decks and materials           |
| **Saved**           | The user's bookmarks                   |
| **Notifications**   | Social activity and processing status  |
| **Profile**         | Identity and the user's content        |
| **Settings, Trash** | Available from the **More** menu       |
| **Create**          | Create a deck or a post                |

---

## Architecture

```
                         Browser / Next.js
                                |
        +-----------------------+------------------------+
        |                       |                        |
   Better Auth          Next.js API Routes      Supabase PostgreSQL
                                |                        ^
                    presigned URL / start job            |  results saved
                                |                        |
        +-------------------- AWS RAG Pipeline ----------+-----------+
        |                                                            |
        |  S3 --> Lambda Orchestrator --> Step Functions             |
        |             --> Lambda Workers --> Google Gemini           |
        |                          --> Lambda Finalizer              |
        +------------------------------------------------------------+
```

### Long-PDF flow

1. The browser requests a presigned URL.
2. The PDF is uploaded directly to private S3.
3. The backend confirms the document and creates a processing marker.
4. S3 triggers the Lambda orchestrator.
5. Step Functions splits the PDF into chunks.
6. Workers extract keywords with Gemini.
7. Results are saved in PostgreSQL.
8. The user selects keywords.
9. A second pipeline generates flashcards and quizzes atomically.

AWS setup, SQL, environment variables, limits, and verification steps are documented in [infra/rag/README.md](infra/rag/README.md). The pipeline uses raw SQL through postgres.js; the legacy endpoints keep working. The active development stack runs in AWS `ap-southeast-2` and has passed an end-to-end smoke test with a synthetic PDF.

---

## Tech Stack

| Layer               | Technology                                                 | Purpose                                                 |
| ------------------- | ---------------------------------------------------------- | ------------------------------------------------------- |
| **Framework**       | [Next.js 16](https://nextjs.org) (App Router)              | Frontend, server rendering, API routes                  |
| **UI**              | [React 19](https://react.dev)                              | Components and interaction                              |
| **Styling**         | [Tailwind CSS 4](https://tailwindcss.com)                  | Layout and the dark-only design system                  |
| **Server state**    | [TanStack React Query v5](https://tanstack.com/query)      | Fetching, caching, infinite queries, optimistic updates |
| **AI**              | [Google Gemini](https://ai.google.dev) via `@google/genai` | Keywords, flashcards, quizzes                           |
| **Database**        | [Supabase PostgreSQL](https://supabase.com)                | Users, decks, documents, social data, quiz results      |
| **Data access**     | `supabase-js`, `postgres`, `pg`                            | CRUD and transactions, no ORM                           |
| **Auth**            | [Better Auth](https://www.better-auth.com)                 | Email/password, Google OAuth, sessions                  |
| **PDF**             | [unpdf](https://github.com/unjs/unpdf)                     | PDF text extraction                                     |
| **Storage**         | Amazon S3                                                  | Private PDF storage                                     |
| **Background jobs** | AWS Lambda + Step Functions                                | Asynchronous RAG and generation                         |
| **Infrastructure**  | CloudFormation / SAM                                       | AWS pipeline deployment                                 |
| **Image builds**    | CodeBuild + ECR                                            | Immutable Lambda images                                 |
| **Monitoring**      | CloudWatch + EventBridge                                   | Logs, alarms, failed-workflow handling                  |
| **Validation**      | Zod                                                        | Payload and API validation                              |
| **Markdown**        | React Markdown, GFM, KaTeX                                 | Posts with Markdown and math                            |
| **Images**          | Sharp                                                      | Image processing                                        |
| **Icons**           | Lucide React                                               | Interface icons                                         |
| **Notifications**   | Sonner                                                     | Toasts and UI feedback                                  |
| **Testing**         | TSX test runner, smoke / E2E scripts                       | API, RAG, database, optimistic mutations                |
| **Code quality**    | TypeScript, ESLint, theme-color checker                    | Type safety and design rules                            |
| **i18n**            | Custom JSON locale system                                  | Indonesian (`id`) and English (`en`)                    |

---

## Security and Reliability

- PDFs are stored in private S3; the browser only receives time-limited presigned URLs.
- The Gemini key and database credentials never leave the server.
- Every API route validates the session and resource ownership.
- PostgreSQL uses default-deny RLS for client roles; server routes are the only access path.
- Generation jobs use locking, quotas, retries, and idempotency.
- Step Functions limits concurrency to protect the Gemini quota.
- AI output is validated before content is published.
- Daily generation limit: 5 per user.

---

## Project Structure

```
yoohoo/
├── src/
│   ├── app/                      # Next.js App Router pages and API routes
│   │   ├── page.tsx              # Landing page
│   │   ├── login/, register/     # Auth pages
│   │   ├── desk/, decks/[id]/    # Your Desk and deck detail
│   │   ├── documents/[id]/       # Flashcards, quiz, results, attempts
│   │   ├── saved/, notifications/, trash/, settings/
│   │   ├── trial/                # Trial mode (no auth)
│   │   └── api/                  # Backend routes (documents, decks, quiz, social, auth)
│   ├── components/               # UI: layout, ui, desk, documents, social, posts,
│   │                             #     feed, explore, profile, public-deck, flashcard
│   ├── hooks/                    # Shared React hooks (e.g. notifications)
│   ├── lib/                      # Gemini integration, auth, i18n, query keys, limits, toast
│   ├── db/                       # Generated Supabase types and connection
│   └── locales/                  # id.json, en.json
├── supabase/migrations/          # SQL migrations (schema source of truth)
├── infra/rag/                    # AWS RAG pipeline: templates, setup, README
├── lambdas/                      # Lambda functions for the pipeline
├── scripts/                      # DB, seed, and test scripts
├── docs/                         # Project notes
├── .env.local                    # Environment variables (not committed)
└── package.json
```

---

## Getting Started

### Prerequisites

- **Node.js** >= 18
- **Supabase** project (PostgreSQL)
- **Google Gemini API** key ([get one here](https://aistudio.google.com/apikey))
- **Google OAuth** credentials (optional, for Google sign-in)
- **AWS account** with the RAG pipeline deployed (required for long-PDF processing, see [infra/rag/README.md](infra/rag/README.md))

### 1. Clone and install

```bash
git clone <your-repo-url>
cd yoohoo
npm install
```

### 2. Environment variables

Create `.env.local`:

```env
# -- Database -----------------------------------------------------------
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-server-only-key
SUPABASE_DATABASE_URL=postgresql://postgres.project:password@pooler.supabase.com:6543/postgres?sslmode=require
SUPABASE_PROJECT_ID=your-project-ref

# -- AI -----------------------------------------------------------------
GEMINI_API_KEY=your-google-gemini-api-key
# GEMINI_MODEL=gemini-3.5-flash        # optional: override default model

# -- Auth ---------------------------------------------------------------
BETTER_AUTH_SECRET=your-random-secret-at-least-32-chars
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret

# -- App URL ------------------------------------------------------------
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

AWS-related variables (S3 bucket, region, state machine, and so on) are listed in [infra/rag/README.md](infra/rag/README.md).

### 3. Database setup

```bash
# Link the project once, apply migrations, then regenerate types
npm run db:link
npm run db:push
npm run db:types
```

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint

npm run db:link      # Link the Supabase project (once)
npm run db:push      # Apply pending SQL migrations
npm run db:verify    # Lint the linked database
npm run db:types     # Refresh generated database types

npm run ai:test      # Test Gemini connection
npm run api:test     # Run API end-to-end tests
```

See `package.json` for the full list (smoke tests, seed scripts, and other checks).

---

## API Endpoints (documents and quiz)

Social, deck, and public-deck routes live under `src/app/api` as well. The core document flow:

| Method   | Endpoint                                | Description                                                    |
| -------- | --------------------------------------- | -------------------------------------------------------------- |
| `POST`   | `/api/documents/generate`               | Legacy direct upload: generate flashcards and quiz, save to DB |
| `GET`    | `/api/documents`                        | List active documents (excludes trashed)                       |
| `DELETE` | `/api/documents/:id`                    | Soft delete (move to trash)                                    |
| `GET`    | `/api/documents/trash`                  | List trashed documents, auto-delete after 30 days              |
| `POST`   | `/api/documents/:id/restore`            | Restore from trash                                             |
| `DELETE` | `/api/documents/:id/permanent`          | Permanent delete with cascade                                  |
| `POST`   | `/api/documents/:id/generate`           | Start or resume selected-keyword RAG generation                |
| `GET`    | `/api/documents/:id/generate?jobId=...` | Poll background generation status                              |
| `GET`    | `/api/documents/:id/flashcards`         | Fetch flashcards                                               |
| `GET`    | `/api/documents/:id/quiz`               | Fetch quiz questions and sets                                  |
| `POST`   | `/api/documents/:id/quiz/regenerate`    | Generate a new quiz set (uses the document's content language) |
| `POST`   | `/api/quiz/:docId/submit`               | Submit answers and compute the score                           |
| `GET`    | `/api/documents/:id/attempts`           | List quiz attempts                                             |
| `POST`   | `/api/trial/generate`                   | Trial generation (no auth, results in `localStorage`)          |
| `POST`   | `/api/documents/save-trial`             | Migrate trial data into a saved document                       |

---

## Database

- **Engine**: PostgreSQL on [Supabase](https://supabase.com), accessed through `supabase-js`, generated types, `postgres`/`pg`, and SQL RPC. No ORM.
- **Source of truth**: SQL files in `supabase/migrations/`.
- **Access model**: RLS is enabled and clients get no direct table access; all reads and writes go through server routes that check the Better Auth session and `user_id`.

### Main tables

| Area                   | Tables                                                                                                                 |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Auth (Better Auth)** | `user`, `session`, and related auth tables                                                                             |
| **Learning**           | `documents`, `flashcards`, `quiz_sets`, `quiz_questions`, `quiz_attempts`                                              |
| **Decks and posts**    | decks, public deck snapshots, posts                                                                                    |
| **Social**             | `likes`, `reposts`, `bookmarks` (polymorphic `target_type` / `target_id`), `follows`, comments, notifications, reports |

Like, repost, and bookmark rows are keyed by `(user_id, target_type, target_id)`, so repeating a request never creates duplicates, and counters change only when a row is really inserted or deleted.

### Schema change workflow

1. Create a new SQL migration in `supabase/migrations/` (never edit one that has already been applied).
2. Review the SQL carefully, especially anything that touches data, grants, or RLS.
3. Back up the production database before applying schema changes.
4. Apply it:

   ```bash
   npm run db:link   # once
   npm run db:push
   ```

5. Regenerate types and commit them together with the migration:

   ```bash
   npm run db:types
   ```

6. Optionally lint the linked database with `npm run db:verify`.

### Notes

- Keep every production schema change as a reviewed SQL migration.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to browser code.
- Vercel only runs `next build`; it does not sync the schema. Apply migrations from your machine **before** deploying code that depends on them.

---

## Internationalization

| Language         | UI locale | Content language        |
| ---------------- | --------- | ----------------------- |
| Bahasa Indonesia | `id.json` | `contentLanguage: "id"` |
| English          | `en.json` | `contentLanguage: "en"` |

**UI language** is toggled from the language switcher and affects all labels, buttons, and messages.

**Content language** is chosen during upload and controls the language of the generated flashcards and quiz questions, independent of the UI language.

---

## Deployment

### App (Vercel recommended)

1. Push to GitHub.
2. Import the repo in [Vercel](https://vercel.com/new).
3. Set the environment variables below.
4. Deploy.

```bash
npm run build   # production build check
```

### Environment variables for production

- `SUPABASE_URL`: project API URL
- `SUPABASE_SERVICE_ROLE_KEY`: server-only service role key
- `SUPABASE_DATABASE_URL`: PostgreSQL connection string (Better Auth and the RAG pipeline)
- `SUPABASE_PROJECT_ID`: project ref for the Supabase CLI
- `BETTER_AUTH_URL` or `NEXT_PUBLIC_APP_URL`: production domain
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: add the production domain to authorized origins
- `trustedOrigins` in `src/lib/auth.ts`: add the production domain
- AWS pipeline variables: see [infra/rag/README.md](infra/rag/README.md)

### AWS RAG pipeline

Deployed separately with CloudFormation/SAM (Lambda images built by CodeBuild and stored in ECR). Follow [infra/rag/README.md](infra/rag/README.md).

---

## License

MIT
