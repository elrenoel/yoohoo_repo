# Testing Scenarios — Yoohoo App

Panduan testing menyeluruh untuk semua fitur. Setiap skenario mencakup **langkah**, **kondisi**, dan **hasil yang diharapkan**.

---

## RAG pipeline tests

`npm run rag:test` menguji chunking tanpa pemotongan 8.000 kata, deteksi scan,
parsing/dedupe keyword, isolasi key S3, ekstraksi PDF dan rendering PNG nyata,
serta batas workflow/IAM. `npm run rag:smoke -- --local-ai` memanggil Gemini nyata.
`npm run rag:aws:e2e` menjalankan fixture terisolasi melalui stack AWS yang sudah
dideploy dan membersihkan row/objek test setelah selesai. Tes DB dan detailnya ada
di [panduan RAG](infra/rag/README.md#verification-and-one-document-example).
`rag:aws:e2e` membutuhkan deployment tetapi tidak session user; smoke melalui
endpoint browser (`rag:smoke`) membutuhkan session test user. Local AI smoke tidak
menguji S3, Lambda, Step Functions, atau frontend.

## Table of Contents

1. [Authentication](#1-authentication)
2. [PDF Upload & Generation](#2-pdf-upload--generation)
3. [Trial Mode (Anonymous)](#3-trial-mode-anonymous)
4. [Save Trial to Account](#4-save-trial-to-account)
5. [Daily Limit & Rate Limiting](#5-daily-limit--rate-limiting)
6. [Content Language](#6-content-language)
7. [Flashcards](#7-flashcards)
8. [Quiz](#8-quiz)
9. [Quiz Regenerate](#9-quiz-regenerate)
10. [History & Attempt Review](#10-history--attempt-review)
11. [Trash System (Soft Delete)](#11-trash-system-soft-delete)
12. [Auto-Migration (Trial to Account)](#12-auto-migration-trial-to-account)
13. [i18n (Language Toggle)](#13-i18n-language-toggle)
14. [Edge Cases & Security](#14-edge-cases--security)
15. [Database Integrity](#15-database-integrity)

---

## 1. Authentication

### TC-AUTH-01: Register with email + password
- **Steps**: Buka `/register`, isi name, email, password (min 8 chars, letters + numbers), konfirmasi password, klik "Create Account"
- **Expected**: Redirect ke `/`, session aktif, nama user muncul di header

### TC-AUTH-02: Register — password too short
- **Steps**: Isi password kurang dari 8 karakter (e.g., "abc123")
- **Expected**: Error "Password must be at least 8 characters", form tidak submit

### TC-AUTH-03: Register — password without numbers
- **Steps**: Isi password hanya huruf (e.g., "abcdefgh")
- **Expected**: Error "Password must contain at least one number"

### TC-AUTH-04: Register — password without letters
- **Steps**: Isi password hanya angka (e.g., "12345678")
- **Expected**: Error "Password must contain at least one letter"

### TC-AUTH-05: Register — password mismatch
- **Steps**: Isi password "abc12345", konfirmasi "xyz98765"
- **Expected**: Error "Passwords do not match"

### TC-AUTH-06: Register — duplicate email
- **Steps**: Register dengan email yang sudah terdaftar
- **Expected**: Error "An account with this email already exists"

### TC-AUTH-07: Login with email + password
- **Steps**: Buka `/login`, masukkan email + password yang valid, klik "Log in"
- **Expected**: Redirect ke `/`, session aktif, quota info muncul

### TC-AUTH-08: Login — wrong password
- **Steps**: Masukkan email valid tapi password salah
- **Expected**: Error "Invalid email or password"

### TC-AUTH-09: Login — empty fields
- **Steps**: Klik "Log in" tanpa isi email/password
- **Expected**: Error "Email and password are required"

### TC-AUTH-10: Google OAuth — new user
- **Steps**: Klik "Continue with Google", pilih akun Google yang belum terdaftar
- **Expected**: Redirect ke `/register` dengan nama + email terprefill dari Google

### TC-AUTH-11: Google OAuth — existing user
- **Steps**: Klik "Continue with Google", pilih akun Google yang sudah terdaftar
- **Expected**: Redirect ke `/`, session aktif

### TC-AUTH-12: Logout
- **Steps**: Klik tombol logout (icon LogOut di header)
- **Expected**: Session terhapus, redirect ke `/`, tombol login/register muncul

---

## 2. PDF Upload & Generation

### TC-GEN-01: Generate flashcards + quiz dari PDF
- **Steps**: Login, upload PDF valid (1-5 halaman), isi nama dokumen, klik "Generate Flashcards & Quiz"
- **Expected**: Loading overlay muncul dengan 5 step, redirect ke halaman flashcards dokumen baru, flashcards & quiz tersimpan di database

### TC-GEN-02: Upload without selecting file
- **Steps**: Login, klik "Generate Flashcards & Quiz" tanpa upload file
- **Expected**: Error "Please select a PDF file first"

### TC-GEN-03: Upload non-PDF file (.txt)
- **Steps**: Upload file `.txt`
- **Expected**: Error "File format not supported. Please upload a PDF file"

### TC-GEN-04: Upload Office file (.docx)
- **Steps**: Upload file `.docx`
- **Expected**: Error "Word / PowerPoint formats are not directly supported"

### TC-GEN-05: Upload empty PDF (0 bytes)
- **Steps**: Upload PDF kosong
- **Expected**: Error "Empty PDF file (0 bytes)"

### TC-GEN-06: Upload oversized PDF (>15 MB)
- **Steps**: Upload PDF lebih dari 15 MB
- **Expected**: Error "File is too large"

### TC-GEN-07: Upload corrupt PDF (wrong magic bytes)
- **Steps**: Rename file `.txt` jadi `.pdf`, upload
- **Expected**: Error "File is not a valid PDF or has been corrupted"

### TC-GEN-08: Upload PDF image-only (no text)
- **Steps**: Upload PDF yang berisi hanya gambar scan tanpa teks
- **Expected**: Error "No readable text found in this PDF"

### TC-GEN-09: Upload PDF with custom document name
- **Steps**: Upload PDF, isi "My Custom Name" di document name field
- **Expected**: Document saved dengan title "My Custom Name"

### TC-GEN-10: Upload PDF without custom name
- **Steps**: Upload PDF tanpa isi document name
- **Expected**: Document title = filename tanpa ekstensi

### TC-GEN-11: Check daily quota badge
- **Steps**: Login, lihat badge di upload page
- **Expected**: Badge menampilkan sisa quota (e.g., "4/5 generations left today")

### TC-GEN-12: GET /api/documents/generate returns quota
- **Steps**: `GET /api/documents/generate` dengan session aktif
- **Expected**: Response `{ remainingToday, usedToday, dailyLimit }`

### TC-GEN-13: GET /api/documents/generate without auth
- **Steps**: `GET /api/documents/generate` tanpa session
- **Expected**: Response 401 `{ remainingToday: null, requireAuth: true }`

---

## 3. Trial Mode (Anonymous)

### TC-TRIAL-01: First trial generation
- **Steps**: Buka `/` tanpa login, upload PDF, klik "Generate"
- **Expected**: Loading overlay, redirect ke `/trial/flashcards`, data tersimpan di localStorage

### TC-TRIAL-02: Trial data in localStorage
- **Steps**: Setelah trial generate, buka DevTools > Application > Local Storage
- **Expected**: Key `yoohoo_trial_data` berisi JSON (title, raw_text, flashcards, quiz), key `yoohoo_has_used_trial` = "true"

### TC-TRIAL-03: Second trial attempt blocked
- **Steps**: Setelah trial pertama, kembali ke `/`, coba upload lagi
- **Expected**: Redirect ke `/login` dengan pesan "Log in first to generate again"

### TC-TRIAL-04: Trial flashcard navigation
- **Steps**: Di `/trial/flashcards`, klik kartu untuk flip, klik Previous/Next
- **Expected**: Kartu ter-flip, navigasi antar kartu berfungsi

### TC-TRIAL-05: Trial quiz flow
- **Steps**: Dari trial flashcards, klik "Start Quiz", jawab soal, klik "Finish & View Score"
- **Expected**: Redirect ke `/trial/quiz/results`, skor ditampilkan, review jawaban tersedia

### TC-TRIAL-06: Trial — no auth banner
- **Steps**: Lihat halaman trial flashcards/quiz
- **Expected**: Banner "This is your free trial — data is not saved" muncul

### TC-TRIAL-07: Trial — clear localStorage, try again
- **Steps**: Clear localStorage, kembali ke `/`
- **Expected**: Bisa generate trial baru (karena flag sudah di-clear)

---

## 4. Save Trial to Account

### TC-SAVE-01: Save trial to account — success
- **Steps**: Generate trial, login/register, data otomatis tersimpan ke DB
- **Expected**: Redirect ke flashcards page dokumen baru, `yoohoo_trial_data` dihapus dari localStorage

### TC-SAVE-02: Save trial — limit reached
- **Steps**: Generate 5x dengan akun (limit habis), generate trial, login
- **Expected**: Save-trial gagal (429), `yoohoo_trial_data` TIDAK dihapus dari localStorage, user bisa coba lagi besok

### TC-SAVE-03: Save trial — invalid session
- **Steps**: Panggil `POST /api/documents/save-trial` tanpa session
- **Expected**: Response 401 "Sesi tidak invalid"

### TC-SAVE-04: Save trial — empty payload
- **Steps**: Panggil save-trial dengan body kosong
- **Expected**: Response 400 "Data trial tidak lengkap"

### TC-SAVE-05: Save trial — no flashcards
- **Steps**: Panggil save-trial dengan flashcards array kosong
- **Expected**: Response 400 "Data flashcard tidak ditemukan"

### TC-SAVE-06: Save trial — no quiz
- **Steps**: Panggil save-trial dengan quiz array kosong
- **Expected**: Response 400 "Data quiz tidak ditemukan"

---

## 5. Daily Limit & Rate Limiting

### TC-LIMIT-01: Generate within limit
- **Steps**: Login, generate 3x dalam sehari
- **Expected**: Semua berhasil, `remainingToday` berkurang (5 → 4 → 3 → 2)

### TC-LIMIT-02: Generate at limit
- **Steps**: Login, generate 5x dalam sehari
- **Expected**: Generate ke-5 berhasil, `remainingToday` = 0

### TC-LIMIT-03: Generate over limit
- **Steps**: Generate 5x, coba generate ke-6
- **Expected**: Response 429 "Limit harian 5x generate sudah tercapai"

### TC-LIMIT-04: Limit resets next day
- **Steps**: Generate 5x hari ini, ubah `last_generation_date` ke kemarin di DB, generate lagi
- **Expected**: Generate berhasil, counter reset ke 1

### TC-LIMIT-05: Save-trial counts toward limit
- **Steps**: Generate 4x, generate trial, login (save-trial)
- **Expected**: Save-trial berhasil, counter = 5, `remainingToday` = 0

### TC-LIMIT-06: Save-trial over limit
- **Steps**: Generate 5x, generate trial, login
- **Expected**: Save-trial gagal 429, localStorage tetap ada

### TC-LIMIT-07: Quiz regenerate counts toward limit
- **Steps**: Generate 4x, regenerate quiz set
- **Expected**: Regenerate berhasil, counter = 5

### TC-LIMIT-08: Trial IP rate limit
- **Steps**: Panggil `POST /api/trial/generate` 5x dari IP yang sama dalam 1 jam
- **Expected**: Request ke-6 return 429 "Terlalu banyak percobaan trial dari IP ini"

### TC-LIMIT-09: Trial IP rate limit resets
- **Steps**: Tunggu 1 jam setelah rate limit, coba lagi
- **Expected**: Generate trial berhasil lagi

---

## 6. Content Language

### TC-LANG-01: Generate with auto language
- **Steps**: Upload PDF, pilih "Match PDF source language", generate
- **Expected**: Flashcards & quiz dalam bahasa yang sama dengan PDF

### TC-LANG-02: Generate with English
- **Steps**: Upload PDF Indonesia, pilih "English", generate
- **Expected**: Flashcards & quiz dalam bahasa Inggris

### TC-LANG-03: Generate with Bahasa Indonesia
- **Steps**: Upload PDF English, pilih "Bahasa Indonesia", generate
- **Expected**: Flashcards & quiz dalam Bahasa Indonesia

### TC-LANG-04: Content language saved to DB
- **Steps**: Generate dengan content language "en", cek DB
- **Expected**: `documents.content_language` = "en"

### TC-LANG-05: Regenerate uses document language
- **Steps**: Generate dokumen dengan "en", regenerate quiz set
- **Expected**: Quiz set baru dalam bahasa Inggris

---

## 7. Flashcards

### TC-FC-01: View flashcards
- **Steps**: Buka `/documents/{id}/flashcards`
- **Expected**: Flashcards ditampilkan dengan term & progress counter

### TC-FC-02: Flip card
- **Steps**: Klik kartu flashcard
- **Expected**: Kartu ter-flip, definition muncul

### TC-FC-03: Flip with keyboard
- **Steps**: Tekan Space
- **Expected**: Kartu ter-flip

### TC-FC-04: Navigate with arrows
- **Steps**: Tekan panah kanan/kiri
- **Expected**: Pindah ke kartu berikutnya/sebelumnya

### TC-FC-05: Navigate with buttons
- **Steps**: Klik tombol Previous/Next
- **Expected**: Pindah ke kartu berikutnya/sebelumnya

### TC-FC-06: Progress tracking
- **Steps**: Navigasi beberapa kartu
- **Expected**: Progress bar & counter update (e.g., "Card 3 of 10")

### TC-FC-07: End of deck
- **Steps**: Sampai kartu terakhir
- **Expected**: Banner "You've completed all flashcards!" + tombol "Start Quiz"

### TC-FC-08: Previous button disabled at first card
- **Steps**: Di kartu pertama, lihat tombol Previous
- **Expected**: Tombol Previous disabled (opacity-40)

### TC-FC-09: Next button disabled at last card
- **Steps**: Di kartu terakhir, lihat tombol Next
- **Expected**: Tombol Next disabled

---

## 8. Quiz

### TC-QUIZ-01: Start quiz
- **Steps**: Buka `/documents/{id}/quiz`
- **Expected**: Quiz questions ditampilkan, set selector muncul

### TC-QUIZ-02: Select answer
- **Steps**: Klik salah satu opsi jawaban
- **Expected**: Opsi terpilih (highlight), answered counter bertambah

### TC-QUIZ-03: Change answer
- **Steps**: Pilih opsi A, lalu pilih opsi B
- **Expected**: Opsi B terpilih, opsi A tidak terpilih

### TC-QUIZ-04: Navigate questions
- **Steps**: Klik Previous/Next
- **Expected**: Pindah ke soal lain, jawaban tetap tersimpan

### TC-QUIZ-05: Submit quiz — all answered
- **Steps**: Jawab semua soal, klik "Finish & View Score"
- **Expected**: Confirm dialog muncul, submit berhasil, redirect ke results

### TC-QUIZ-06: Submit quiz — partial answered
- **Steps**: Jawab sebagian soal, klik "Finish & View Score"
- **Expected**: Confirm dialog warning "X question(s) haven't been answered", bisa submit atau review

### TC-QUIZ-07: Switch quiz set
- **Steps**: Pilih set berbeda dari dropdown
- **Expected**: Soal berubah, jawaban reset

### TC-QUIZ-08: Quiz results display
- **Steps**: Submit quiz, lihat results page
- **Expected**: Skor ditampilkan, review jawaban per soal (benar/salah)

### TC-QUIZ-09: Submit without auth
- **Steps**: Submit quiz tanpa session
- **Expected**: Redirect ke `/login`

---

## 9. Quiz Regenerate

### TC-REGEN-01: Generate new quiz set
- **Steps**: Di halaman quiz, klik "Generate New Set"
- **Expected**: Loading indicator, set baru muncul di dropdown, soal baru ditampilkan

### TC-REGEN-02: Regenerate uses document language
- **Steps**: Dokumen dengan `content_language: "en"`, regenerate
- **Expected**: Soal baru dalam bahasa Inggris

### TC-REGEN-03: Regenerate counts toward limit
- **Steps**: Generate 4x, regenerate quiz
- **Expected**: Counter = 5, `remainingToday` = 0

### TC-REGEN-04: Regenerate over limit
- **Steps**: Generate 5x, coba regenerate
- **Expected**: Response 429 "Limit harian sudah tercapai"

### TC-REGEN-05: Multiple sets
- **Steps**: Regenerate 2x
- **Expected**: 3 quiz sets tersedia (Set 1, Set 2, Set 3)

### TC-REGEN-06: Regenerate — doc not found
- **Steps**: `POST /api/documents/{invalid-id}/quiz/regenerate`
- **Expected**: Response 400 "ID dokumen tidak valid"

---

## 10. History & Attempt Review

### TC-HIST-01: View history — logged in
- **Steps**: Login, buka `/history`
- **Expected**: Daftar dokumen ditampilkan dengan judul & skor terakhir

### TC-HIST-02: View history — not logged in
- **Steps**: Buka `/history` tanpa login
- **Expected**: Login prompt ditampilkan

### TC-HIST-03: History shows latest score
- **Steps**: Generate dokumen, submit quiz, kembali ke history
- **Expected**: Skor terbaru ditampilkan (e.g., "Last score: 4/7")

### TC-HIST-04: Rename document
- **Steps**: Di history, klik nama dokumen, ubah nama, klik Save
- **Expected**: Nama dokumen ter-update

### TC-HIST-05: View exam history
- **Steps**: Di history, klik tombol exam history (ikon clipboard)
- **Expected**: Redirect ke `/documents/{id}/attempts`

### TC-HIST-06: View attempt detail
- **Steps**: Di attempts page, klik salah satu attempt
- **Expected**: Detail attempt ditampilkan (skor, grade, review per soal)

### TC-HIST-07: Empty history
- **Steps**: Login dengan akun baru (belum generate)
- **Expected**: Empty state "No documents yet — upload your first PDF"

### TC-HIST-08: Delete document from history
- **Steps**: Di history, klik tombol hapus (ikon trash), konfirmasi
- **Expected**: Dokumen pindah ke trash, tidak ada di history lagi

---

## 11. Trash System (Soft Delete)

### TC-TRASH-01: Move to trash
- **Steps**: Dari history, hapus dokumen
- **Expected**: `documents.deleted_at` terisi timestamp, dokumen hilang dari history

### TC-TRASH-02: View trash
- **Steps**: Buka `/trash`
- **Expected**: Daftar dokumen ter-trash ditampilkan

### TC-TRASH-03: Restore from trash
- **Steps**: Di trash, klik "Restore" pada dokumen
- **Expected**: `documents.deleted_at` = NULL, dokumen kembali ke history

### TC-TRASH-04: Permanent delete
- **Steps**: Di trash, klik "Delete Permanently", konfirmasi
- **Expected**: Dokumen + flashcards + quiz + attempts terhapus dari DB

### TC-TRASH-05: Permanent delete — only works on trashed docs
- **Steps**: `DELETE /api/documents/{id}/permanent` pada dokumen aktif (deleted_at NULL)
- **Expected**: Response 404 "Dokumen tidak ditemukan atau belum di-trash"

### TC-TRASH-06: Restore — only works on trashed docs
- **Steps**: `POST /api/documents/{id}/restore` pada dokumen aktif
- **Expected**: Response 404 "Dokumen tidak ditemukan atau tidak sedang di-trash"

### TC-TRASH-07: Auto-delete after 30 days
- **Steps**: Set `deleted_at` ke 31 hari yang lalu di DB, panggil `GET /api/documents/trash`
- **Expected**: Dokumen otomatis terhapus permanen, tidak muncul di trash

### TC-TRASH-08: Empty trash
- **Steps**: Buka `/trash` tanpa dokumen ter-trash
- **Expected**: Empty state "Trash is empty"

### TC-TRASH-09: Trash — 30-day info banner
- **Steps**: Lihat halaman trash
- **Expected**: Info "Documents will be permanently deleted 30 days after being moved to trash"

---

## 12. Auto-Migration (Trial to Account)

### TC-MIG-01: Auto-migration on login
- **Steps**: Generate trial, login dengan akun yang limit masih ada
- **Expected**: Data trial otomatis tersimpan ke DB, redirect ke flashcards, localStorage di-clear

### TC-MIG-02: Auto-migration — limit reached
- **Steps**: Generate 5x, generate trial, login
- **Expected**: Save-trial gagal (429), localStorage TIDAK di-clear, user tetap di halaman

### TC-MIG-03: Auto-migration — invalid trial data
- **Steps**: Set `yoohoo_trial_data` ke string invalid di localStorage, login
- **Expected**: Error caught silently, user tetap di halaman, localStorage tidak di-clear

### TC-MIG-04: Auto-migration — no trial data
- **Steps**: Login tanpa ada `yoohoo_trial_data` di localStorage
- **Expected**: Tidak ada aksi, user di halaman normal

---

## 13. i18n (Language Toggle)

### TC-I18N-01: Toggle to English
- **Steps**: Klik tombol bahasa di header, pilih English
- **Expected**: Seluruh UI berubah ke bahasa Inggris

### TC-I18N-02: Toggle to Bahasa Indonesia
- **Steps**: Klik tombol bahasa, pilih Indonesia
- **Expected**: Seluruh UI berubah ke Bahasa Indonesia

### TC-I18N-03: Language persists across pages
- **Steps**: Ganti bahasa ke English, navigasi ke halaman lain
- **Expected**: Bahasa tetap English di semua halaman

### TC-I18N-04: Language persists after refresh
- **Steps**: Ganti bahasa, refresh page
- **Expected**: Bahasa tetap sesuai pilihan terakhir

---

## 14. Edge Cases & Security

### TC-SEC-01: Access other user's document
- **Steps**: Login sebagai User A, panggil `DELETE /api/documents/{user-b-doc-id}`
- **Expected**: Response 404 (dokumen tidak ditemukan, bukan milik user A)

### TC-SEC-02: Access document without auth
- **Steps**: `GET /api/documents/{id}/flashcards` tanpa session
- **Expected**: Response 401

### TC-SEC-03: Invalid UUID
- **Steps**: `DELETE /api/documents/not-a-uuid`
- **Expected**: Response 400 "ID dokumen tidak valid"

### TC-SEC-04: Empty body on PATCH
- **Steps**: `PATCH /api/documents/{id}` dengan body kosong
- **Expected**: Response 400 "Nama dokumen tidak boleh kosong"

### TC-SEC-05: Title too long
- **Steps**: `PATCH /api/documents/{id}` dengan title > 200 karakter
- **Expected**: Response 400 "Nama dokumen maksimal 200 karakter"

### TC-SEC-06: Double soft delete
- **Steps**: Hapus dokumen (soft delete), coba hapus lagi
- **Expected**: Response 404 "Dokumen tidak ditemukan atau sudah di-trash"

### TC-SEC-07: Restore non-trashed document
- **Steps**: `POST /api/documents/{id}/restore` pada dokumen aktif
- **Expected**: Response 404

### TC-SEC-08: Permanent delete non-trashed document
- **Steps**: `DELETE /api/documents/{id}/permanent` pada dokumen aktif
- **Expected**: Response 404

### TC-SEC-09: XSS in document title
- **Steps**: Create document dengan title `<script>alert(1)</script>`
- **Expected**: Title ditampilkan sebagai teks biasa (tidak execute script)

### TC-SEC-10: Concurrent limit bypass attempt
- **Steps**: 2 tab login akun sama, generate bersamaan saat quota = 1
- **Expected**: Hanya 1 yang berhasil, 1 gagal 429

---

## 15. Database Integrity

### TC-DB-01: Cascade delete on permanent delete
- **Steps**: Buat dokumen dengan flashcards + quiz + attempts, permanent delete
- **Expected**: Semua data terkait (flashcards, quiz_sets, quiz_questions, quiz_attempts) ikut terhapus

### TC-DB-02: Cascade delete on user delete
- **Steps**: Hapus user dari DB
- **Expected**: Semua dokumen + data terkait ikut terhapus

### TC-DB-03: Trial save creates all relations
- **Steps**: Save trial, cek DB
- **Expected**: documents, flashcards, quiz_sets, quiz_questions semua terisi dengan data yang benar

### TC-DB-04: Content language persists
- **Steps**: Generate dengan content_language "en", cek DB
- **Expected**: `documents.content_language` = "en", flashcards & quiz dalam bahasa Inggris

### TC-DB-05: Schema matches expected tables
- **Steps**: Jalankan `npm run db:verify`
- **Expected**: Tidak ada error, schema.ts sesuai dengan database

---

## Yoohoo Reference: Test Data

### Valid PDF for testing
- Gunakan PDF 2-5 halaman dengan teks yang jelas (e.g., materi kuliah OS)

### Test accounts
```
User A: test-a@example.com / password123
User B: test-b@example.com / password456
```

### Expected limits
- Daily limit: 5 generations per user
- Trial IP rate limit: 5 per IP per hour
- Max file size: 15 MB
- Trash retention: 30 days

---

## How to Run Tests

### Manual testing
```bash
npm run dev
# Buka http://localhost:3000
# Ikuti skenario di atas secara manual
```

### API testing (curl)
```bash
# Login dulu, ambil session cookie, lalu panggil endpoint

# Generate
curl -X POST http://localhost:3000/api/documents/generate \
  -H "Cookie: session=..." \
  -F "file=@test.pdf" \
  -F "title=Test Document"

# Check quota
curl http://localhost:3000/api/documents/generate \
  -H "Cookie: session=..."

# List documents
curl http://localhost:3000/api/documents \
  -H "Cookie: session=..."

# Trash
curl http://localhost:3000/api/documents/trash \
  -H "Cookie: session=..."
```

### Database verification
```bash
npm run db:link      # Link project Supabase
npm run db:verify    # Lint schema remote
npm run db:types     # Regenerate TypeScript database types
# Gunakan Table Editor / SQL Editor di Supabase Dashboard untuk inspeksi data
```
# Selected-keyword RAG generation

The authenticated end-to-end path is now PDF upload -> keyword extraction ->
keyword selection -> background generation -> flashcards -> quiz. Verify that a
refresh on the generation page resumes the same `jobId`, does not consume a second
quota slot, and never exposes another user's job. A failed chunk must leave the
existing flashcards/quiz unchanged; only a fully completed job publishes results.

Run the focused checks with:

```powershell
npm.cmd run rag:test
npm.cmd run rag:build
npm.cmd run typecheck
```
