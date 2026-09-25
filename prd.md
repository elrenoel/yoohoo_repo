Planning: Upload → RAG Chunking → Keyword Selection

Konteks untuk AI coding assistant. Ini scope tahap pertama saja: dari user upload PDF sampai sistem menampilkan **list keyword yang bisa dipilih user** untuk dijadikan flashcard. Generate flashcard/quiz aktual dari keyword terpilih ada di scope terpisah (belum dibahas di sini).

Stack: Next.js, Supabase (Postgres, tanpa ORM — raw SQL), AWS (S3, Lambda, Step Functions), Gemini API.

---

## 1. Masalah yang mau diselesaikan

Alur lama: seluruh teks PDF digabung jadi satu, dipotong ke 8.000 kata, baru dikirim ke Gemini sekali jalan untuk generate flashcard+quiz langsung.

Masalah untuk materi panjang (ebook 100+ halaman, dsb):

- Bagian setelah ~8.000 kata pertama **tidak pernah diproses sama sekali**
- Window konteks yang kepanjangan meningkatkan risiko model salah/ngarang (halusinasi)
- User tidak punya kontrol — semua keyword yang muncul di flashcard hasil "tebakan" AI, bukan pilihan user

## 2. Target alur baru

```
PDF diupload
  ↓
File disimpan (S3)
  ↓
Ekstraksi teks per halaman (existing: unpdf; tambahan: Gemini Vision untuk halaman hasil scan/tulisan tangan)
  ↓
Chunking: pecah jadi beberapa bagian, tiap bagian ~5-10 halaman, TIDAK dipotong isi teksnya
  ↓
Tiap chunk diproses PARALEL → panggil Gemini (flash-lite) → "sebutkan istilah/topik penting di teks ini"
  ↓
Kumpulkan semua hasil dari semua chunk
  ↓
Dedupe keyword yang mirip/duplikat antar chunk
  ↓
Simpan candidate keywords ke DB
  ↓
Update status dokumen → siap ditampilkan
  ↓
FRONTEND: tampilkan list keyword ke user, user centang mana yang mau dijadikan flashcard
```

Poin penting: karena tiap chunk diproses **paralel** dan independen, panjang dokumen (10 halaman atau 100 halaman) tidak lagi jadi masalah context-window — yang berubah cuma jumlah chunk yang diproses.

## 3. Skema DB untuk tahap ini

```sql
create extension if not exists "uuid-ossp";
create extension if not exists vector;

-- Dokumen yang diupload user
documents (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) not null,
  filename      text not null,
  storage_path  text not null,        -- key di S3
  file_size     bigint not null,
  page_count    int,
  status        text not null default 'uploaded',
    -- 'uploaded' -> 'chunking' -> 'indexing' -> 'ready_for_selection' -> 'failed'
  error_message text,                 -- diisi kalau status = 'failed'
  created_at    timestamptz default now()
);

-- Potongan teks hasil chunking, jadi rujukan retrieval nanti pas generate flashcard
document_chunks (
  id            uuid primary key default gen_random_uuid(),
  document_id   uuid references documents(id) on delete cascade,
  chunk_index   int not null,
  page_start    int,
  page_end      int,
  content       text not null,        -- teks asli, utuh, tidak dipotong
  embedding     vector(768),          -- opsional: gemini-embedding-001, dipakai untuk dedupe
  created_at    timestamptz default now()
);

-- Kandidat keyword hasil tahap MAP, ditampilkan ke user untuk dipilih
candidate_keywords (
  id            uuid primary key default gen_random_uuid(),
  document_id   uuid references documents(id) on delete cascade,
  chunk_id      uuid references document_chunks(id),  -- rujukan balik ke teks asal, dipakai saat generate nanti
  term          text not null,
  snippet       text,                 -- cuplikan konteks singkat, buat preview di UI
  is_selected   boolean default false,
  created_at    timestamptz default now()
);

create index on document_chunks (document_id);
create index on candidate_keywords (document_id);
```

## 4. Arsitektur pemrosesan (AWS)

```
Client upload
  ↓ (request presigned URL dari backend, upload langsung ke S3)
S3 (simpan PDF asli)
  ↓ (S3 event trigger)
Lambda #1 — Orkestrator
  - Ekstrak teks per halaman
  - Deteksi halaman "kemungkinan scan" (existing logic: >2 halaman tapi <20 kata hasil ekstraksi)
  - Pecah jadi chunks (5-10 halaman/chunk)
  - Insert rows ke document_chunks (Supabase)
  - Trigger Step Functions
  ↓
Step Functions (Map state — jalan PARALEL per chunk)
  ↓
Lambda #2 — Worker per chunk
  - Kalau chunk normal → kirim content ke Gemini flash-lite, minta ekstrak keyword+snippet
  - Kalau chunk "kemungkinan scan" → kirim gambar halaman ke Gemini Vision
  - Insert hasil ke candidate_keywords (Supabase)
  ↓
Lambda #3 — Finalizer (jalan setelah semua chunk selesai)
  - Dedupe keyword mirip (string similarity dulu; embedding kalau perlu lebih presisi)
  - Update documents.status = 'ready_for_selection'
```

**Kenapa harus async/background job, bukan diproses langsung dalam satu request:** dokumen panjang perlu banyak pemanggilan Gemini (satu per chunk), totalnya bisa memakan waktu lebih dari batas timeout request HTTP biasa, apalagi kalau backend serverless.

**Progress tracking:** karena user tidak bisa langsung dapat hasil instan, frontend perlu polling status `documents.status` (atau pakai Supabase Realtime subscribe ke perubahan row) supaya bisa nampilin "memproses halaman X dari Y..." dan otomatis nampilin keyword list begitu status jadi `ready_for_selection`.

## 5. Yang perlu diputuskan/dieksperimen

- **Ukuran chunk optimal** — mulai dari asumsi 5-10 halaman/chunk, perlu dites langsung: kalau terlalu kecil jadi banyak API call (mahal, lambat), kalau terlalu besar balik ke masalah lama (window kepanjangan)
- **Format prompt tahap MAP** — instruksi ke Gemini per chunk, kira-kira: "dari teks berikut, sebutkan 3-8 istilah/topik penting beserta cuplikan kalimat yang menyebutkannya, hindari istilah generik seperti judul bab/pendahuluan" — perlu disusun & dites biar konsisten
- **Metode dedupe** — mulai dari string matching case-insensitive (simpel, gratis); baru pakai `gemini-embedding-001` + cosine similarity kalau ternyata banyak keyword mirip tapi beda penulisan yang lolos dedupe simpel
- **Handling gambar/scan** — perlu ekstrak PDF jadi gambar per halaman dulu sebelum bisa dikirim ke Gemini Vision (library terpisah dari `unpdf` yang cuma baca text layer)

## 6. Definition of Done untuk tahap ini

- [ ] User upload PDF (sampai 100MB) → tersimpan di S3, row `documents` dibuat dengan status `uploaded`
- [ ] Background pipeline jalan otomatis (Lambda + Step Functions), tidak blocking request upload
- [ ] Dokumen dipecah jadi chunks, tersimpan di `document_chunks` dengan teks utuh (tidak terpotong)
- [ ] Tiap chunk diproses Gemini, hasil keyword tersimpan di `candidate_keywords` dengan rujukan `chunk_id`
- [ ] Keyword mirip/duplikat antar chunk sudah di-dedupe sebelum ditampilkan
- [ ] Halaman hasil scan/tulisan tangan terdeteksi dan diproses lewat jalur Gemini Vision, bukan gagal diam-diam
- [ ] Frontend bisa polling/subscribe status dokumen dan menampilkan list keyword begitu siap
- [ ] User bisa mencentang/memilih keyword mana saja dari list yang mau dijadikan flashcard (state ini disimpan di `candidate_keywords.is_selected`, dipakai sebagai input tahap generate berikutnya)
