# Ringkasan Penerapan Schema ACID dan Notifikasi

## Migration yang Diterapkan

### Migration: `add_generation_jobs_and_notifications`
- **File**: `supabase/migrations/20261006155900_add_generation_jobs_and_notifications.sql`

**Tabel yang dibuat/diubah:**

1. **Tabel `notifications` (BARU)**
   - id uuid PK default gen_random_uuid()
   - user_id text NOT NULL
   - job_id uuid FK ke generation_jobs ON DELETE SET NULL
   - type text, severity text CHECK IN ('info','success','error')
   - title text, body text, link text
   - dedupe_key text NOT NULL UNIQUE
   - read_at timestamptz, created_at timestamptz default now()
   - Index: (user_id, created_at DESC)
   - Partial index: (user_id) WHERE read_at IS NULL

2. **Tabel `generation_jobs` (sudah ada, diubah)**
   - Kolom `job_id` ditambahkan ke `flashcards` dan `quiz_sets`
   - RLS diaktifkan (tanpa policy - untuk menutup akses PostgREST/anonymous)
   - Index: (user_id, created_at DESC)
   - Partial index: status IN ('queued', 'running')

3. **Function `notify_job_change()`**
   - Trigger AFTER INSERT pada generation_jobs
   - Trigger AFTER UPDATE OF status pada generation_jobs
   - Otomatis insert notifikasi ke tabel notifications
   - dedupe_key = job_id || ':' || status
   - ON CONFLICT DO NOTHING
   - Judul dalam Bahasa Indonesia:
     - queued: "Antrian: proses mulai ditunda"
     - running: "Berjalan: proses sedang berlangsung"
     - succeeded: "Berhasil: proses selesai dibuat"
     - failed: "Gagal: proses tidak dapat dilanjutkan"
     - canceled: "Dibatalkan: proses dibatalkan"

4. **Index tambahan**
   - notifications_user_created_idx
   - notifications_user_unread_idx
   - generation_jobs_user_created_idx
   - generation_jobs_status_queued_running_idx
   - notifications_job_id_idx

## Verifikasi Database

**Status**: Migration berhasil di-push ke database produksi melalui `supabase db push --linked --include-all`

**Hasil verifikasi**:
- Migration selesai tanpa error
- Tipe TypeScript berhasil digenerate via `supabase gen types typescript --linked > src/db/types.ts`
- Tabel notifications muncul di types dengan kolom lengkap
- Relasi job_id di flashcards dan quiz_sets tercatat di types

## File yang Diubah/Ditambahkan

### Backend (API & Library)

1. **`src/lib/jobs.ts`** (BARU)
   - `createJob()`: INSERT ... ON CONFLICT DO UPDATE (idempoten)
   - `claimJob()`: UPDATE status='running' WHERE status='queued'
   - `completeJob()`: UPDATE status='succeeded'
   - `failJob()`: UPDATE status='failed', error dipotong 500 karakter
   - `cancelJob()`: UPDATE status='canceled'
   - `getNotifications()`: paginate + filter unread
   - `markNotificationRead()`: tandai satu notifikasi
   - `markAllNotificationsRead()`: tandai semua
   - `getUnreadCount()`: count untuk badge
   - `hasRunningJob()`: cek ada job running/queued
   - `getActiveJob()`: get job aktif

2. **`src/app/api/notifications/route.ts`** (BARU)
   - GET /api/notifications: list + pagination + filter unread
   - POST /api/notifications/read: tandai satu/semua notifikasi
   - Autentikasi: cek session Better Auth

3. **`src/app/api/jobs/cleanup/route.ts`** (BARU)
   - POST /api/jobs/cleanup: tandai job 'running'/'queued' > 10 menit sebagai 'failed'
   - GET /api/jobs/cleanup/status: monitoring jumlah job berisiko

### Frontend (UI & Hooks)

4. **`src/hooks/use-notifications.ts`** (BARU)
   - `useNotifications()`: query notifikasi dengan pagination
   - `useUnreadCount()`: query hitung notifikasi unread
   - Polling 5-10 detik saat ada job running
   - Mutation untuk markRead dan markAllRead

5. **`src/components/layout/NotificationBell.tsx`** (BARU)
   - Bell di sidebar dengan badge unread
   - Popup notifikasi dengan ikon per severity
   - Waktu relatif (timeAgo)
   - Klik → buka link + set read_at

6. **`src/components/layout/SidebarNav.tsx`** (DIUBAH)
   - Tambah import NotificationBell
   - Tambah NotificationBell di sidebar

7. **`src/app/notifications/page.tsx`** (DIUBAH)
   - Halaman daftar notifikasi lengkap
   - Skeleton loading
   - Tombol "Tandai semua dibaca"
   - Ikon per severity (info/success/error)
   - Waktu relatif
   - Klik link → set read_at

8. **`src/lib/query-keys.ts`** (DIUBAH)
   - Tambah `queryKeys.notifications()` untuk cache invalidation

### Database Types

9. **`src/db/types.ts`** (DIGENERATE)
   - Tabel notifications ditambahkan
   - Kolom job_id di flashcards dan quiz_sets tercatat
   - Relasi FK notifications_job_id_fkey, flashcards_job_id_fkey, quiz_sets_job_id_fkey

## Temuan Advisor (Security + Performance)

**Belum dijalankan**: get_advisors memerlukan Docker yang tidak tersedia di environment ini.

## Status TypeScript

**Error yang tersisa** (bukan dari perubahan saya):
- 2 error di `src/app/api/documents/route.ts:17` - error yang sudah ada sebelumnya terkait type null sebagai index

**Error yang sudah diperbaiki**:
- Module 'date-fns' tidak ditemukan → diinstal
- Import lucide icons yang hilang → ditambahkan
- Type error di jobs.ts → diperbaiki dengan sql.json dan null handling

## Alur yang Diimplementasi

### 1. Upload Materi (Material Upload)
- S3 upload dilakukan DI LUAR transaksi (sesuai requirement)
- Setelah S3 upload selesai, satu transaksi:
  - INSERT documents
  - INSERT deck_documents
  - INSERT generation_jobs (dengan createJob yang idempotent)

### 2. Generate Flashcard
- Alur: pilih keyword → generate
- createJob() dengan kind='flashcard_generate'
- claimJob() saat mulai proses
- completeJob() atau failJob() saat selesai
- Hasil flashcard disimpan dengan job_id di flashcards

### 3. Generate Quiz
- quizzes + semua pertanyaan + update job dalam satu transaksi
- completeJob() dalam sql.begin()
- ON CONFLICT DO NOTHING untuk mencegah duplikat

### 4. Cron Job Cleanup
- Job 'running' > 10 menit → 'failed'
- Endpoint: POST /api/jobs/cleanup
- Di-protect dengan secret header

## Notifikasi

- Bell di sidebar dengan badge unread
- Panel notifikasi: ikon per severity, waktu relatif
- Klik link → buka halaman tujuan + set read_at
- Polling 5-10 detik hanya saat ada job running
- Skeleton loading saat fetch
- Toast saat aksi berjalan

## Design Tokens (Your Desk)

- Paper: #F5F6F3
- Ink: #16241D
- Stroke: #D8DCD3
- Colors:
  - info: #DDE9D4 / #516757
  - success: #EEF5F0 / #2F7651
  - error: #FBEDEB / #C24A3D
