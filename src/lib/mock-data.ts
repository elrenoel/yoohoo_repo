export interface MockFlashcard {
  id: string;
  term: string;
  definition: string;
}

export interface MockQuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex?: number; // Optional for client preview
}

export interface MockDocument {
  id: string;
  title: string;
  wordCount: number;
  totalPages: number;
  flashcards: MockFlashcard[];
  quiz: MockQuizQuestion[];
}

export const MOCK_DOCUMENT: MockDocument = {
  id: "demo-os-memory",
  title: "Sistem Operasi: Virtual Memory & Manajemen Paging",
  wordCount: 513,
  totalPages: 1,
  flashcards: [
    {
      id: "fc-1",
      term: "Virtual Memory",
      definition:
        "Teknik manajemen memori yang memisahkan memori logis pengguna dari memori fisik (RAM), memungkinkan eksekusi proses berukuran besar dengan memanfaatkan media penyimpanan sekunder.",
    },
    {
      id: "fc-2",
      term: "Paging",
      definition:
        "Skema manajemen memori non-contiguous yang membagi memori fisik menjadi Frame dan ruang alamat logis menjadi Page berukuran tetap untuk menghindari fragmentasi eksternal.",
    },
    {
      id: "fc-3",
      term: "Page Table",
      definition:
        "Struktur data milik setiap proses yang memetakan nomor Page logis ke nomor Frame fisik di dalam RAM.",
    },
    {
      id: "fc-4",
      term: "Translation Lookaside Buffer (TLB)",
      definition:
        "Cache hardware berkecepatan tinggi yang menyimpan translasi alamat page-to-frame terbaru untuk meminimalkan waktu akses memori fisik.",
    },
    {
      id: "fc-5",
      term: "Demand Paging",
      definition:
        "Strategi pemuatan page ke dalam RAM hanya saat page tersebut benar-benar diakses atau dibutuhkan oleh CPU selama eksekusi.",
    },
    {
      id: "fc-6",
      term: "Page Fault",
      definition:
        "Interupsi hardware yang dipicu saat instruksi CPU mencoba mengakses page yang belum dimuat di dalam memori fisik (RAM).",
    },
    {
      id: "fc-7",
      term: "Belady's Anomaly",
      definition:
        "Fenomena anomali pada algoritma FIFO di mana penambahan frame memori fisik justru menyebabkan peningkatan frekuensi terjadinya page fault.",
    },
    {
      id: "fc-8",
      term: "Thrashing",
      definition:
        "Kondisi kritis di mana sistem operasi menghabiskan lebih banyak waktu untuk operasi I/O swap/paging daripada mengeksekusi instruksi program nyata.",
    },
  ],
  quiz: [
    {
      id: "qz-1",
      question:
        "Mengapa teknologi Virtual Memory memungkinkan eksekusi program yang ukurannya melebihi kapasitas RAM fisik?",
      options: [
        "Karena sistem operasi mengompres seluruh file program agar pas di memori RAM.",
        "Karena program disimpan sepenuhnya di dalam cache CPU L1/L2.",
        "Karena memori logis dipisahkan dari fisik dan sistem memanfaatkan media penyimpanan sekunder sebagai swap area.",
        "Karena memori RAM fisik otomatis memperluas kapasitasnya saat proses berjalan.",
      ],
      correctIndex: 2,
    },
    {
      id: "qz-2",
      question:
        "Apa perbedaan mendasar antara Page dan Frame dalam skema Paging?",
      options: [
        "Page adalah blok di storage sekunder, sedangkan Frame adalah blok di cache CPU.",
        "Page adalah blok pada ruang alamat logis, sedangkan Frame adalah blok pada memori fisik RAM.",
        "Page berukuran variabel, sedangkan Frame memiliki ukuran yang tetap.",
        "Page hanya dipakai untuk FIFO, sedangkan Frame dipakai untuk algoritma LRU.",
      ],
      correctIndex: 1,
    },
    {
      id: "qz-3",
      question:
        "Apa fungsi utama dari Translation Lookaside Buffer (TLB) dalam arsitektur komputer?",
      options: [
        "Menyimpan seluruh isi Page Table dari setiap proses secara permanen.",
        "Mempercepat translasi alamat virtual ke alamat fisik dengan menyimpan translasi terbaru.",
        "Menggantikan peran RAM fisik ketika terjadi pemadaman listrik secara mendadak.",
        "Mengatur penjadwalan antrean proses di CPU (CPU Scheduling).",
      ],
      correctIndex: 1,
    },
    {
      id: "qz-4",
      question:
        "Langkah awal apa yang dilakukan CPU ketika mendeteksi terjadinya Page Fault?",
      options: [
        "Langsung menghentikan (terminate) proses yang berjalan secara permanen.",
        "Melakukan restart sistem operasi untuk membebaskan ruang memori.",
        "Memicu trap/interupsi ke sistem operasi agar OS memuat page dari disk ke RAM.",
        "Menggandakan kapasitas memori virtual proses tersebut.",
      ],
      correctIndex: 2,
    },
    {
      id: "qz-5",
      question:
        "Manakah dari algoritma Page Replacement berikut yang terbukti secara matematis tidak mengalami Belady's Anomaly?",
      options: [
        "FIFO (First-In, First-Out)",
        "Optimal (OPT) dan LRU (Least Recently Used)",
        "Clock / Second-Chance Algorithm saja",
        "Semua algoritma page replacement pasti mengalami Belady's Anomaly",
      ],
      correctIndex: 1,
    },
    {
      id: "qz-6",
      question:
        "Apa penyebab utama terjadinya fenomena Thrashing pada sistem komputer?",
      options: [
        "Kerusakan fisik pada salah satu slot modul RAM.",
        "Terlalu banyak proses yang berjalan sehingga total kebutuhan working-set melebihi kapasitas RAM yang tersedia.",
        "Ukuran page table yang lebih kecil dibandingkan ukuran page offset.",
        "Kabel koneksi hard drive yang mengalami penurunan kecepatan transfer data.",
      ],
      correctIndex: 1,
    },
  ],
};
