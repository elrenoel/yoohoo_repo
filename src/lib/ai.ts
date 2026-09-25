import { GoogleGenAI, type SchemaUnion } from "@google/genai";

export interface GeneratedFlashcard {
  term: string;
  definition: string;
}

export interface GeneratedQuizQuestion {
  question: string;
  options: string[];
  correct_index: number;
}

export interface StudyMaterialsResult {
  flashcards: GeneratedFlashcard[];
  quiz: GeneratedQuizQuestion[];
  rawWordCount: number;
  isTruncated: boolean;
  usedModel?: string;
  latencyMs?: number;
}

export interface QuizOnlyResult {
  quiz: GeneratedQuizQuestion[];
  rawWordCount: number;
  isTruncated: boolean;
  usedModel?: string;
  latencyMs?: number;
}

const SYSTEM_INSTRUCTION = `Kamu adalah asisten belajar cerdas dan spesialis active recall tingkat universitas.

TUGAS FLASHCARD:
1. Identifikasi 8-15 istilah teknis, konsep utama, hukum/rumus, atau mekanisme proses spesifik dari materi.
2. JANGAN membuat flashcard untuk kata-kata umum non-konseptual (seperti "Pengantar", "Pendahuluan", "Bab 1", "Kesimpulan", "Tujuan Pembelajaran").
3. Untuk tiap istilah (term), tuliskan definisi yang padat, presisi, dan mudah dipahami (maksimal 2 kalimat).

TUGAS QUIZ PILIHAN GANDA:
1. Buat 5-8 soal pilihan ganda konseptual (menguji pemahaman 'mengapa', 'bagaimana', sebab-akibat, atau studi kasus mini).
2. Setiap soal WAJIB memiliki tepat 4 opsi jawaban (options array panjang 4).
3. Buat opsi pengecoh (distractor) yang masuk akal dan relevan dengan materi, jangan membuat opsi yang konyol atau terlalu mudah ditebak.
4. Panjang kalimat antarpilihan jawaban harus seimbang agar jawaban benar tidak mencolok.
5. 'correct_index' WAJIB berupa integer (0, 1, 2, atau 3) yang menunjukkan indeks posisi jawaban yang benar pada array options (0 = opsi ke-1, 1 = opsi ke-2, 2 = opsi ke-3, 3 = opsi ke-4).

FORMAT OUTPUT:
Balas HANYA dengan JSON valid sesuai struktur schema tanpa pengantar teks apapun.`;

const QUIZ_ONLY_SYSTEM_INSTRUCTION = `Kamu adalah asisten belajar cerdas dan spesialis active recall tingkat universitas.

TUGAS QUIZ PILIHAN GANDA (HANYA QUIZ):
1. Buat 5-8 soal pilihan ganda konseptual yang BARU dan BERBEDA dari materi yang sama (menguji pemahaman 'mengapa', 'bagaimana', sebab-akibat, atau studi kasus mini).
2. Setiap soal WAJIB memiliki tepat 4 opsi jawaban (options array panjang 4).
3. Buat opsi pengecoh (distractor) yang masuk akal dan relevan dengan materi, jangan membuat opsi yang konyol atau terlalu mudah ditebak.
4. Panjang kalimat antarpilihan jawaban harus seimbang agar jawaban benar tidak mencolok.
5. 'correct_index' WAJIB berupa integer (0, 1, 2, atau 3) yang menunjukkan indeks posisi jawaban yang benar pada array options (0 = opsi ke-1, 1 = opsi ke-2, 2 = opsi ke-3, 3 = opsi ke-4).
6. JANGAN mengeluarkan flashcard — hanya array quiz.

FORMAT OUTPUT:
Balas HANYA dengan JSON valid sesuai struktur schema tanpa pengantar teks apapun.`;

const MAX_WORDS_LIMIT = 8000;

// Daftar model tier berurutan: dimulai dari model ultra-cepat (flash-lite ~4s)
// kemudian fallback ke flash flagship jika diperlukan saat 503/429
const DEFAULT_MODEL_TIERS = [
  "gemini-3.5-flash-lite",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
];

const FULL_RESPONSE_SCHEMA: SchemaUnion = {
  type: "object",
  properties: {
    flashcards: {
      type: "array",
      description: "Daftar istilah penting dan definisi ringkas",
      items: {
        type: "object",
        properties: {
          term: { type: "string", description: "Istilah teknis atau konsep inti spesifik" },
          definition: {
            type: "string",
            description: "Definisi singkat dan padat (maks 2 kalimat)",
          },
        },
        required: ["term", "definition"],
      },
    },
    quiz: {
      type: "array",
      description: "Daftar soal pilihan ganda konseptual berbobot",
      items: {
        type: "object",
        properties: {
          question: { type: "string", description: "Pertanyaan yang menguji pemahaman" },
          options: {
            type: "array",
            description: "Tepat 4 opsi pilihan jawaban yang seimbang",
            items: { type: "string" },
          },
          correct_index: {
            type: "integer",
            description: "Index jawaban yang benar (0, 1, 2, atau 3)",
          },
        },
        required: ["question", "options", "correct_index"],
      },
    },
  },
  required: ["flashcards", "quiz"],
};

const QUIZ_RESPONSE_SCHEMA: SchemaUnion = {
  type: "object",
  properties: {
    quiz: {
      type: "array",
      description: "Daftar soal pilihan ganda konseptual berbobot",
      items: {
        type: "object",
        properties: {
          question: { type: "string", description: "Pertanyaan yang menguji pemahaman" },
          options: {
            type: "array",
            description: "Tepat 4 opsi pilihan jawaban yang seimbang",
            items: { type: "string" },
          },
          correct_index: {
            type: "integer",
            description: "Index jawaban yang benar (0, 1, 2, atau 3)",
          },
        },
        required: ["question", "options", "correct_index"],
      },
    },
  },
  required: ["quiz"],
};

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Memvalidasi dan membersihkan data flashcards & quiz dari AI
 */
function sanitizeAiOutput(data: {
  flashcards?: unknown[];
  quiz?: unknown[];
}): { flashcards: GeneratedFlashcard[]; quiz: GeneratedQuizQuestion[] } {
  const cleanCards: GeneratedFlashcard[] = [];
  const cleanQuiz: GeneratedQuizQuestion[] = [];

  // 1. Sanitasi Flashcards
  if (Array.isArray(data.flashcards)) {
    for (const item of data.flashcards) {
      if (item && typeof item === "object") {
        const card = item as Record<string, unknown>;
        const term = typeof card.term === "string" ? card.term.trim() : "";
        const definition =
          typeof card.definition === "string" ? card.definition.trim() : "";

        // Abaikan istilah generik kosong
        if (term.length > 1 && definition.length > 3) {
          cleanCards.push({ term, definition });
        }
      }
    }
  }

  // 2. Sanitasi Quiz Questions
  if (Array.isArray(data.quiz)) {
    for (const item of data.quiz) {
      if (item && typeof item === "object") {
        const q = item as Record<string, unknown>;
        const question = typeof q.question === "string" ? q.question.trim() : "";
        const rawOptions = Array.isArray(q.options) ? q.options : [];
        const options = rawOptions
          .map((opt) => (typeof opt === "string" ? opt.trim() : String(opt || "")))
          .filter(Boolean);

        let correctIndex =
          typeof q.correct_index === "number" ? Math.floor(q.correct_index) : 0;

        // Pastikan opsi tepat 4 dan correct_index berada dalam range 0-3
        if (question.length > 5 && options.length === 4) {
          if (correctIndex < 0 || correctIndex > 3) {
            correctIndex = 0;
          }
          cleanQuiz.push({
            question,
            options,
            correct_index: correctIndex,
          });
        }
      }
    }
  }

  return { flashcards: cleanCards, quiz: cleanQuiz };
}

interface AiCallParams {
  systemInstruction: string;
  responseSchema: SchemaUnion;
  promptSuffix: string;
  rawText: string;
}

interface AiCallResult {
  parsed: unknown;
  rawWordCount: number;
  isTruncated: boolean;
  usedModel?: string;
  latencyMs?: number;
}

/**
 * Core AI caller: potong teks ke maks 8000 kata, coba beberapa model Gemini
 * secara berurutan (fallback 503/429), lalu parse respons JSON.
 */
async function callAiWithFallback(params: AiCallParams): Promise<AiCallResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    throw new Error(
      "GEMINI_API_KEY belum dikonfigurasi di file environment variables (.env.local)"
    );
  }

  // Cek batas kata (maks ~8000 kata sesuai Section 9 PRD)
  const words = params.rawText.trim().split(/\s+/).filter(Boolean);
  const isTruncated = words.length > MAX_WORDS_LIMIT;
  const processedText = isTruncated
    ? words.slice(0, MAX_WORDS_LIMIT).join(" ")
    : params.rawText;

  const configuredModel = process.env.GEMINI_MODEL;

  // Susun daftar model unik yang akan dicoba berurutan
  const modelCandidates = Array.from(
    new Set(
      [configuredModel, ...DEFAULT_MODEL_TIERS].filter(
        (m): m is string => Boolean(m && m.trim())
      )
    )
  );

  const ai = new GoogleGenAI({ apiKey });
  const prompt = `Berikut adalah materi pembelajaran yang harus dianalisis:\n\n---\n${processedText}\n---\n\n${params.promptSuffix}`;

  let lastError: unknown = null;
  const startTime = Date.now();

  for (let i = 0; i < modelCandidates.length; i++) {
    const currentModel = modelCandidates[i];
    const attemptNum = i + 1;

    try {
      console.log(
        `🤖 [AI Generate] Mencoba model (${attemptNum}/${modelCandidates.length}): ${currentModel}...`
      );

      const response = await ai.models.generateContent({
        model: currentModel,
        contents: prompt,
        config: {
          systemInstruction: params.systemInstruction,
          temperature: 0.2, // Rendah untuk deterministik & jawaban konsisten
          maxOutputTokens: 3072,
          responseMimeType: "application/json",
          responseSchema: params.responseSchema,
        },
      });

      const rawJson = response.text || "";
      let cleanJson = rawJson.trim();
      if (cleanJson.startsWith("```json")) {
        cleanJson = cleanJson.slice(7);
      } else if (cleanJson.startsWith("```")) {
        cleanJson = cleanJson.slice(3);
      }
      if (cleanJson.endsWith("```")) {
        cleanJson = cleanJson.slice(0, -3);
      }
      cleanJson = cleanJson.trim();

      const parsed = JSON.parse(cleanJson);

      const latencyMs = Date.now() - startTime;
      console.log(
        `✅ [AI Generate] Berhasil menggunakan model ${currentModel} (${latencyMs}ms)!`
      );

      return {
        parsed,
        rawWordCount: words.length,
        isTruncated,
        usedModel: currentModel,
        latencyMs,
      };
    } catch (error) {
      lastError = error;
      const errorMsg = error instanceof Error ? error.message : String(error);

      console.warn(
        `⚠️ Model ${currentModel} mengalami kendala: ${errorMsg}. Beralih ke model cadangan berikutnya...`
      );

      if (i < modelCandidates.length - 1) {
        await sleep(500);
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Gagal memproses materi dengan seluruh kandidat Gemini model.");
}

/**
 * Generate flashcards & quiz questions dari teks materi menggunakan Google Gemini API
 * dengan prompt berkualitas tinggi, multi-model fallback & sanitasi ketat.
 */
const LANGUAGE_INSTRUCTIONS: Record<string, string> = {
  id: "\n\nPERHATIAN: Seluruh output flashcard (term & definition) DAN quiz (question & options) WAJIB dalam Bahasa Indonesia, terlepas dari bahasa asli materi sumber.",
  en: "\n\nIMPORTANT: All flashcard output (term & definition) AND quiz output (question & options) MUST be in English, regardless of the source material's original language.",
};

export async function generateStudyMaterials(
  rawText: string,
  contentLanguage?: string
): Promise<StudyMaterialsResult> {
  const langSuffix = contentLanguage && contentLanguage !== "auto"
    ? LANGUAGE_INSTRUCTIONS[contentLanguage] || ""
    : "";

  const result = await callAiWithFallback({
    systemInstruction: SYSTEM_INSTRUCTION,
    responseSchema: FULL_RESPONSE_SCHEMA,
    promptSuffix:
      `Ekstrak flashcards konsep spesifik dan quiz pilihan ganda bermutu dari materi di atas dalam format JSON.${langSuffix}`,
    rawText,
  });

  const sanitized = sanitizeAiOutput(result.parsed as {
    flashcards?: unknown[];
    quiz?: unknown[];
  });

  if (sanitized.flashcards.length === 0 && sanitized.quiz.length === 0) {
    throw new Error("AI mengembalikan output kosong.");
  }

  return {
    flashcards: sanitized.flashcards,
    quiz: sanitized.quiz,
    rawWordCount: result.rawWordCount,
    isTruncated: result.isTruncated,
    usedModel: result.usedModel,
    latencyMs: result.latencyMs,
  };
}

/**
 * Generate HANYA quiz questions baru (untuk fitur regenerate quiz per set).
 * Prompt khusus quiz, multi-model fallback & sanitasi ketat.
 */
export async function generateQuizQuestions(
  rawText: string,
  contentLanguage?: string
): Promise<QuizOnlyResult> {
  const langSuffix = contentLanguage && contentLanguage !== "auto"
    ? LANGUAGE_INSTRUCTIONS[contentLanguage] || ""
    : "";

  const result = await callAiWithFallback({
    systemInstruction: QUIZ_ONLY_SYSTEM_INSTRUCTION,
    responseSchema: QUIZ_RESPONSE_SCHEMA,
    promptSuffix:
      `Buat soal pilihan ganda bermutu yang BARU dari materi di atas dalam format JSON (hanya array quiz).${langSuffix}`,
    rawText,
  });

  const sanitized = sanitizeAiOutput(result.parsed as { quiz?: unknown[] });

  if (sanitized.quiz.length === 0) {
    throw new Error("AI tidak berhasil menghasilkan soal kuis baru.");
  }

  return {
    quiz: sanitized.quiz,
    rawWordCount: result.rawWordCount,
    isTruncated: result.isTruncated,
    usedModel: result.usedModel,
    latencyMs: result.latencyMs,
  };
}
