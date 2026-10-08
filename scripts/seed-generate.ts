import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";
import { INTERESTS, USER_COUNT, seedUserSchema } from "./seed-lib";

if (process.env.NODE_ENV === "production") throw new Error("Generate seed ditolak di production.");
const apiKey = process.env.GEMINI_API_KEY?.trim();
if (!apiKey) throw new Error("GEMINI_API_KEY belum diatur.");
const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash-lite";
if (!model.includes("flash-lite")) throw new Error(`Model ditolak: ${model}. Seed hanya boleh memakai model flash-lite proyek.`);
const client = new GoogleGenAI({ apiKey });
const root = path.join(process.cwd(), "scripts", "seed-data", "users");
const stringField = (maxLength: number) => ({ type: "string", minLength: 1, maxLength });
const responseJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["display_name", "username", "bio", "decks", "caption", "post_tags"],
  properties: {
    display_name: stringField(50),
    username: { type: "string", pattern: "^[a-z0-9_]{3,20}$" },
    bio: stringField(160),
    caption: stringField(500),
    post_tags: { type: "array", minItems: 0, maxItems: 3, items: stringField(30) },
    image_spec: {
      type: "object", additionalProperties: false, required: ["title", "points"],
      properties: { title: stringField(80), points: { type: "array", minItems: 4, maxItems: 6, items: stringField(120) } },
    },
    decks: {
      type: "array", minItems: 2, maxItems: 2,
      items: {
        type: "object", additionalProperties: false,
        required: ["title", "description", "tags", "language", "cards", "questions"],
        properties: {
          title: stringField(120), description: stringField(500),
          tags: { type: "array", minItems: 2, maxItems: 4, items: stringField(30) },
          language: { type: "string", enum: ["id"] },
          cards: {
            type: "array", minItems: 8, maxItems: 12,
            items: { type: "object", additionalProperties: false, required: ["front", "back"], properties: { front: stringField(500), back: stringField(2000) } },
          },
          questions: {
            type: "array", minItems: 5, maxItems: 8,
            items: {
              type: "object", additionalProperties: false,
              required: ["question", "options", "correct_index", "explanation"],
              properties: {
                question: stringField(1000), options: { type: "array", minItems: 4, maxItems: 4, items: stringField(500) },
                correct_index: { type: "integer", minimum: 0, maximum: 3 }, explanation: stringField(2000),
              },
            },
          },
        },
      },
    },
  },
} as const;

let calls = 0, retries = 0, failed = 0, completed = 0, estimatedTokens = 0, consecutive429 = 0, stopped = false;
const usernames = new Set<string>();
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const status = (error: unknown) => Number((error as { status?: unknown })?.status ?? (error as { code?: unknown })?.code ?? 0);

async function cached(index: number) {
  try {
    const value = seedUserSchema.parse(JSON.parse(await readFile(path.join(root, `user-${String(index + 1).padStart(2, "0")}.json`), "utf8")));
    if (usernames.has(value.username)) return undefined;
    usernames.add(value.username); return value;
  } catch { return undefined; }
}

function parseGenerated(raw: string) {
  const decoded: unknown = JSON.parse(raw);
  // Beberapa versi Gemini membungkus satu hasil JSON dalam array meskipun
  // prompt meminta satu objek. Terima hanya wrapper dengan tepat satu item.
  const value = Array.isArray(decoded) && decoded.length === 1 ? decoded[0] : decoded;
  return seedUserSchema.parse(value);
}

async function generate(index: number) {
  const file = path.join(root, `user-${String(index + 1).padStart(2, "0")}.json`);
  const hit = await cached(index);
  if (hit) { completed++; console.log(`${completed}/${USER_COUNT} cache`); return; }
  const postType = index % 3 === 0 ? "teks saja" : index % 3 === 1 ? "teks dan gambar catatan belajar" : "teks dan deck tersemat";
  for (let attempt = 1; attempt <= 3 && !stopped; attempt++) {
    if (calls >= 150) { stopped = true; throw new Error("Batas keras 150 panggilan Gemini tercapai."); }
    calls++;
    try {
      const response = await client.models.generateContent({
        model,
        contents: `Buat satu persona pelajar Indonesia dengan bidang unik: ${INTERESTS[index]}. Index ${index}. Jenis post: ${postType}. Hasil harus faktual dan Bahasa Indonesia. Username wajib unik, lowercase a-z0-9_ sepanjang 3-20. Dua deck tidak boleh bertopik sama: masing-masing 8-12 kartu dan 5-8 soal pilihan ganda (tepat 4 opsi), correct_index harus benar. Caption santai 1-3 kalimat maksimal 500 karakter, tag 0-3 lowercase. ${index % 3 === 1 ? "Wajib sertakan image_spec berisi title dan 4-6 points." : "Jangan sertakan image_spec."}`,
        config: { responseMimeType: "application/json", responseJsonSchema, maxOutputTokens: 8000, temperature: 0.35, httpOptions: { timeout: 60_000 } },
      });
      estimatedTokens += Number(response.usageMetadata?.totalTokenCount ?? 0);
      const parsed = parseGenerated(response.text ?? "");
      if (usernames.has(parsed.username)) throw new Error(`Username duplikat: ${parsed.username}`);
      usernames.add(parsed.username); consecutive429 = 0;
      await writeFile(file, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
      completed++; console.log(`${completed}/${USER_COUNT}`); return;
    } catch (error) {
      const is429 = status(error) === 429;
      consecutive429 = is429 ? consecutive429 + 1 : 0;
      if (consecutive429 >= 3) { stopped = true; throw new Error("Tiga error 429 berturut-turut; generate dihentikan dan cache dipertahankan."); }
      if (attempt === 3) { failed++; console.error(`Lewati user-${index + 1}:`, error instanceof Error ? error.message : error); return; }
      retries++; await sleep(1000 * 2 ** (attempt - 1));
    }
  }
}

let cursor = 0;
async function worker() { while (!stopped) { const next = cursor++; if (next >= USER_COUNT) return; await generate(next); } }
async function main() {
  await mkdir(root, { recursive: true });
  try { await Promise.all([worker(), worker()]); }
  finally { console.log(JSON.stringify({ model, calls, retries, failed, completed, estimatedTotalTokens: estimatedTokens }, null, 2)); }
  if (stopped || failed > 0 || completed !== USER_COUNT) process.exitCode = 1;
}
void main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
