# Yoohoo

## PDF panjang: keyword selection (RAG)

Alur utama tersedia di `/app`: presigned upload PDF hingga 100 MB, background
chunking, ekstraksi keyword per chunk, dan pemilihan keyword. Setup AWS, SQL,
environment, batasan, dan verifikasi ada di [infra/rag/README.md](infra/rag/README.md).
Pipeline baru memakai raw SQL melalui postgres.js; endpoint lama tetap berjalan.
Stack development aktif di AWS `ap-southeast-2` dan sudah melewati smoke test
PDF sintetis end-to-end.
Pembuatan flashcard dari keyword terpilih merupakan tahap berikutnya.

> **AI-powered Active Recall Generator** — Upload a PDF, select the keywords extracted by the RAG pipeline, then study generated flashcards before taking the quiz.

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" />
  <img src="https://img.shields.io/badge/Gemini-AI-4285F4?logo=google" />
  <img src="https://img.shields.io/badge/PostgreSQL-Supabase-3FCF8E?logo=supabase" />
  <img src="https://img.shields.io/badge/License-MIT-green" />
</p>

---

## What is Yoohoo?

Yoohoo eliminates **passive reading** by transforming your lecture PDFs, e-books, and study notes into **active recall tools** — flashcards for concept review and quizzes for self-assessment.

### Core Loop

```
Upload PDF  -->  AI Analysis  -->  Flashcards  -->  Quiz  -->  Score & Review
```

---

## How It Works — End-to-End Flow

```
+-----------------------------------------------------------------------------+
|                        USER UPLOADS PDF                                     |
|                    (lecture slides, e-book, notes)                          |
+-----------------------------------+-----------------------------------------+
                                    |
                                    v
+-----------------------------------------------------------------------------+
|                      SERVER: EXTRACT TEXT                                   |
|            unpdf library parses PDF -> raw text extraction                   |
|            (max 8,000 words sent to AI)                                    |
+-----------------------------------+-----------------------------------------+
                                    |
                                    v
+-----------------------------------------------------------------------------+
|                   AI: GOOGLE GEMINI ANALYSIS                               |
|                                                                             |
|  System Prompt + Raw Text  ->  Gemini API  ->  Structured JSON Output      |
|                                                                             |
|  +------------------+    +------------------+                              |
|  |   FLASHCARDS     |    |   QUIZ SET       |                              |
|  | - 8-15 terms     |    | - 5-8 questions  |                              |
|  | - Key concepts   |    | - 4 options each |                              |
|  | - Definitions    |    | - Correct answer |                              |
|  +------------------+    +------------------+                              |
|                                                                             |
|  > Exponential retry tetap memakai GEMINI_MODEL yang sama                 |
|  > If language selected: AI generates in target language                   |
+-----------------------------------+-----------------------------------------+
                                    |
                                    v
+-----------------------------------------------------------------------------+
|                    SAVE TO POSTGRESQL DATABASE                              |
|            documents -> flashcards -> quiz_sets -> quiz_questions           |
+-----------------------------------+-----------------------------------------+
                                    |
                     +--------------+--------------+
                     v              v              v
             +----------+  +----------+  +--------------+
             | FLASHCARD |  |  QUIZ    |  |  HISTORY     |
             |  PAGE     |  |  PAGE    |  |  & SCORES    |
             |           |  |          |  |              |
             | - Flip    |  | - Answer |  | - View all   |
             | - Navigate|  | - Submit |  |   attempts   |
             | - Keyboard|  | - Score  |  | - Review     |
             |   hints   |  | - Review |  |   answers    |
             +----------+  +----------+  +--------------+
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | [Next.js 16](https://nextjs.org) (App Router) | Full-stack React framework with API routes |
| **UI** | [React 19](https://react.dev) + [Tailwind CSS 4](https://tailwindcss.com) | Component-based UI with utility-first styling |
| **State** | [TanStack React Query v5](https://tanstack.com/query) | Server state management, caching, and refetching |
| **AI** | [Google Gemini API](https://ai.google.dev) | Flashcard & quiz generation via structured JSON output |
| **Database** | [Supabase PostgreSQL](https://supabase.com) | PostgreSQL, Data API, and transactional RPC |
| **Data access** | `@supabase/supabase-js` + `pg` | Server CRUD tanpa ORM; PostgreSQL driver untuk Better Auth |
| **Auth** | [Better Auth](https://www.better-auth.com) | Email/password + Google OAuth, session management |
| **PDF Parsing** | [unpdf](https://github.com/nicepkg/unpdf) | Server-side PDF text extraction |
| **Icons** | [Lucide React](https://lucide.dev) | Consistent icon library |
| **i18n** | Custom JSON locale system | Indonesian (id) & English (en) support |

---

## Project Structure

```
yoohoo/
├── src/
│   ├── app/                          # Next.js App Router pages
│   │   ├── page.tsx                  # Landing page & PDF upload
│   │   ├── layout.tsx                # Root layout with providers
│   │   ├── login/page.tsx            # Email/password + Google login
│   │   ├── register/page.tsx         # Registration with Google OAuth
│   │   ├── history/page.tsx          # Document history list
│   │   ├── trash/page.tsx            # Soft-deleted documents
│   │   ├── documents/[id]/
│   │   │   ├── flashcards/page.tsx   # Interactive flashcard viewer
│   │   │   ├── quiz/page.tsx         # Quiz session & scoring
│   │   │   ├── quiz/results/page.tsx # Quiz results display
│   │   │   └── attempts/             # Exam history & review
│   │   ├── trial/                    # Free trial mode (no auth)
│   │   └── api/                      # Backend API routes
│   │       ├── documents/            # CRUD + generate endpoints
│   │       │   ├── generate/route.ts # Main generation endpoint
│   │       │   ├── [id]/             # Per-document operations
│   │       │   │   ├── generate/     # Re-generate flashcards
│   │       │   │   ├── quiz/regenerate/ # Generate new quiz set
│   │       │   │   ├── flashcards/   # Fetch flashcards
│   │       │   │   ├── attempts/     # Quiz attempt history
│   │       │   │   ├── restore/      # Restore from trash
│   │       │   │   └── permanent/    # Permanent delete
│   │       │   ├── trash/route.ts    # Trash listing + 30-day cleanup
│   │       │   └── save-trial/       # Migrate trial -> saved document
│   │       ├── quiz/                 # Quiz submission & scoring
│   │       ├── trial/                # Trial generation endpoint
│   │       └── auth/                 # Better Auth handlers
│   ├── components/                   # Shared UI components
│   ├── lib/                          # Utilities & config
│   │   ├── ai.ts                     # Gemini API integration
│   │   ├── auth.ts                   # Better Auth configuration
│   │   ├── i18n.tsx                  # Internationalization hook
│   │   ├── query-keys.ts             # TanStack Query key factory
│   │   ├── query-provider.tsx        # React Query provider
│   │   ├── session-provider.tsx      # Auth session context
│   │   ├── daily-limit.ts            # Rate limiting (5/day)
│   │   └── format-date.ts            # Date formatting utilities
│   ├── db/
│   │   ├── types.ts                  # Supabase generated database types
│   │   └── index.ts                  # Database connection
│   └── locales/                      # i18n translations
│       ├── id.json                   # Indonesian
│       └── en.json                   # English
├── scripts/                          # DB migration & test scripts
├── .env.local                        # Environment variables (not committed)
└── package.json
```

---

## Features

### PDF Upload & AI Generation
- Drag-and-drop PDF upload (max 15 MB)
- Automatic text extraction via `unpdf`
- Multi-model Gemini fallback (`flash-lite` -> `flash` -> `flash` classic)
- Up to 8,000 words processed per document
- **Content language selector**: Auto (match PDF), Bahasa Indonesia, or English

### Interactive Flashcards
- Flip-card animation (click or press Space)
- Keyboard navigation (arrow keys)
- Progress tracking with card counter
- End-of-deck celebration + quiz CTA

### Quiz System
- Multiple-choice questions (4 options each)
- Question set selector (multiple sets per document)
- **Regenerate** — create new quiz sets with one click
- Submit confirmation dialog
- Per-question answer review (correct/wrong/skipped)

### History & Attempt Review
- Full exam history per document
- Detailed answer review with correct/wrong indicators
- Score grading (Excellent / Good / Needs Practice / Review Material)
- Date-time tracking per attempt

### Trash System (Soft Delete)
- Deleted documents move to trash (not permanent)
- Restore from trash back to history
- Permanent delete with confirmation
- **Auto-cleanup**: documents permanently deleted after 30 days

### Authentication
- Email + password registration (min 8 chars, letters + numbers)
- Google OAuth login
- Smart flow: unregistered Google users get redirected to register with prefilled data
- Daily generation limit: **5 per day** for logged-in users

### Internationalization (i18n)
- Full UI in **Bahasa Indonesia** and **English**
- Content language override for AI output (independent from UI language)

---

## Getting Started

### Prerequisites

- **Node.js** >= 18
- **Supabase PostgreSQL** project
- **Google Gemini API** key ([get one here](https://aistudio.google.com/apikey))
- **Google OAuth** credentials (for Google login, optional)

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd yoohoo
npm install
```

### 2. Environment Variables

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

### 3. Database Setup

```bash
# Link project once, apply migrations, then generate types
npm run db:link
npm run db:push
npm run db:types
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/documents/generate` | Upload PDF, AI generate flashcards + quiz, save to DB |
| `GET` | `/api/documents` | List all active documents (excludes trashed) |
| `DELETE` | `/api/documents/:id` | Soft delete (move to trash) |
| `GET` | `/api/documents/trash` | List trashed documents + auto-delete 30-day expired |
| `POST` | `/api/documents/:id/restore` | Restore document from trash |
| `DELETE` | `/api/documents/:id/permanent` | Permanently delete document + cascade |
| `POST` | `/api/documents/:id/generate` | Start/resume selected-keyword RAG generation |
| `GET` | `/api/documents/:id/generate?jobId=...` | Poll background RAG generation status |
| `GET` | `/api/documents/:id/flashcards` | Fetch flashcards |
| `GET` | `/api/documents/:id/quiz` | Fetch quiz questions + sets |
| `POST` | `/api/documents/:id/quiz/regenerate` | Generate new quiz set (uses doc's content language) |
| `POST` | `/api/quiz/:docId/submit` | Submit quiz answers, compute score |
| `GET` | `/api/documents/:id/attempts` | List all quiz attempts |
| `POST` | `/api/trial/generate` | Trial generation (no auth, results in localStorage) |
| `POST` | `/api/documents/save-trial` | Migrate trial data to saved document |

---

## Database Schema

```
+--------------+     +--------------+     +--------------+
|     user     |     |  documents   |     |  flashcards  |
+--------------+     +--------------+     +--------------+
| id (PK)      |<--| id (PK)      |<--| id (PK)      |
| email        |   | user_id (FK) |--| document_id  |--+
| name         |   | title        |   | term          |  |
| password     |   | raw_text     |   | definition    |  |
| generation_  |   | content_lang  |   +--------------+  |
|   count_today|   | deleted_at   |                      |
| last_gen_    |   | created_at   |   +--------------+  |
|   date       |   +--------------+   |  quiz_sets    |  |
+--------------+                      +--------------+  |
                                      | id (PK)      |<-+
                                      | document_id  |-|
                                      | label        | |
                                      | created_at   | |
                                      +--------------+ |
                                                     |
                   +--------------+    +--------------+
                   |quiz_questions|    | quiz_attempts |
                   +--------------+    +--------------+
                   | id (PK)      |    | id (PK)      |
                   | document_id  |    | document_id  |--+
                   | quiz_set_id  |--+ | session_id   |  |
                   | question     |  | | score        |  |
                   | options[]    |  | | total        |  |
                   | correct_idx  |  | | answers[]    |  |
                   +--------------+  | | quiz_set_id  |--+
                                     +-| created_at   |  |
                                       +--------------+  |
                                                     |
                   +--------------+                   |
                   |   session    |                   |
                   +--------------+                   |
                   | id (PK)      |                   |
                   | user_id (FK) |                   |
                   | token        |                   |
                   | expires_at   |                   |
                   +--------------+                   |
```

---

## Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint

npm run db:push      # Push schema changes to database (primary workflow)
npm run db:verify    # Verify schema matches database
npm run db:types     # Refresh generated database types

npm run ai:test      # Test Gemini AI connection
npm run api:test     # Run API end-to-end tests
```

---

## Internationalization

The app supports two languages:

| Language | UI Locale | Content Language |
|----------|-----------|-----------------|
| Bahasa Indonesia | `id.json` | `contentLanguage: "id"` |
| English | `en.json` | `contentLanguage: "en"` |

**UI Language** — toggled via the language button in the header. Affects all labels, buttons, and messages.

**Content Language** — selected during PDF upload. Controls the language of AI-generated flashcards and quiz questions, independent of the UI language.

---

## Database Guide

### Database Overview

- **Engine**: PostgreSQL hosted on [Supabase](https://supabase.com)
- **Data access**: Supabase JavaScript query builder, generated types, dan SQL RPC (tanpa ORM)
- **Schema file**: `src/db/schema.ts` (single source of truth)

### Schema Change Workflow

This project uses `db:push` to apply schema changes directly to the database. No migration files are generated or committed to git.

**Step 1: Edit schema**

```bash
# Edit src/db/schema.ts (add column, table, etc.)
# Example: add a new column to documents table
```

**Step 2: Push to database**

```bash
# Reads schema.ts, compares with DB, applies changes
npm run db:push
```

When prompted, type `y` to confirm pushing the changes.

**Step 3: Verify (optional)**

```bash
# Check if schema.ts matches the actual database
npm run db:verify
```

**Step 4: Deploy**

```bash
git add -A && git commit -m "feat: add new column"
git push origin main
# Vercel auto-deploys, no migration step needed
```

SQL migrations under `supabase/migrations` are the schema source of truth.

### Useful Commands

```bash
npm run db:push      # Apply pending SQL migrations
npm run db:verify    # Lint the linked database
npm run db:types     # Refresh TypeScript database types
```

### Production Deployment

**Before deploying to production:**

```bash
# 1. Apply schema changes to production database
npm run db:link
npm run db:push

# 2. Deploy app to Vercel
git push origin main
```

Vercel only runs `next build` -- it does not auto-sync schema. Always push schema changes from local before deploying.

**Alternatively, set Vercel build command to auto-push:**

```
npm run db:push && npm run build
```

In Vercel Dashboard:
1. Project Settings -> Build & Development Settings
2. Build Command: `npm run db:push && npm run build`
3. Pastikan environment Supabase server-only sudah tersedia dan project CLI sudah di-link

### Important Notes

- **Source of truth**: SQL files in `supabase/migrations`; regenerate `src/db/types.ts` after schema changes.
- **Migration history**: Keep every production schema change as a reviewed SQL migration.
- **Production backup**: Always backup production database before pushing schema changes.
- **Server-only key**: Never expose `SUPABASE_SERVICE_ROLE_KEY` to browser code.
- **`db:push` review**: Review pending SQL carefully before applying it to production.

---

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import in [Vercel](https://vercel.com/new)
3. Set environment variables (see below)
4. Deploy

```bash
npm run build   # production build
```

### Environment Variables for Production

Make sure to update:
- `SUPABASE_URL` -> project API URL
- `SUPABASE_SERVICE_ROLE_KEY` -> server-only service role key
- `SUPABASE_DATABASE_URL` -> PostgreSQL connection string untuk Better Auth
- `SUPABASE_PROJECT_ID` -> project ref untuk Supabase CLI
- `BETTER_AUTH_URL` or `NEXT_PUBLIC_APP_URL` -> your production domain
- `GOOGLE_CLIENT_ID` -> add production domain to authorized origins
- `trustedOrigins` in `src/lib/auth.ts` -> add production domain

---

## License

MIT
