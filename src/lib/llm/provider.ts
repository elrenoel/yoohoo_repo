import {
  GoogleGenAI,
  type ContentListUnion,
  type SchemaUnion,
} from "@google/genai";

const DEFAULT_MODEL = "gemini-3.5-flash-lite";
const DEFAULT_TIMEOUT_MS = 65_000;
const MAX_ATTEMPTS = 4;

export interface GenerateOptions<T> {
  contents: ContentListUnion;
  systemInstruction: string;
  responseSchema?: SchemaUnion;
  temperature?: number;
  maxOutputTokens?: number;
  stage: string;
  validate?: (value: unknown) => T;
}

export interface LlmResult<T> {
  value: T;
  model: string;
  latencyMs: number;
}

function apiKey() {
  const value = process.env.GEMINI_API_KEY?.trim();
  if (!value) throw new Error("GEMINI_API_KEY is required");
  return value;
}

export function configuredGeminiModel() {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
}

function statusCode(error: unknown) {
  if (!error || typeof error !== "object") return undefined;
  const value = error as { status?: unknown; code?: unknown; $metadata?: { httpStatusCode?: unknown } };
  const candidate = value.status ?? value.code ?? value.$metadata?.httpStatusCode;
  if (typeof candidate === "number") return candidate;
  if (typeof candidate === "string" && /^\d{3}$/.test(candidate)) return Number(candidate);
  return undefined;
}

function shouldRetry(error: unknown) {
  const status = statusCode(error);
  return status === undefined || status === 408 || status === 429 || status >= 500;
}

async function withRetry<T>(stage: string, model: string, operation: () => Promise<T>) {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!shouldRetry(error) || attempt === MAX_ATTEMPTS - 1) throw error;
      const delayMs = Math.min(1_000 * 2 ** attempt + Math.floor(Math.random() * 250), 10_000);
      console.warn("[LLM] Gemini call failed; retrying the same model", {
        stage,
        model,
        attempt: attempt + 1,
        delayMs,
        status: statusCode(error),
        errorType: error instanceof Error ? error.name : "Unknown",
      });
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

function parseJson(raw: string) {
  let clean = raw.trim();
  if (clean.startsWith("```json")) clean = clean.slice(7);
  else if (clean.startsWith("```")) clean = clean.slice(3);
  if (clean.endsWith("```")) clean = clean.slice(0, -3);
  return JSON.parse(clean.trim()) as unknown;
}

/** The only Gemini text/JSON gateway. Retries never switch models. */
export async function generateWithGemini<T = string>(options: GenerateOptions<T>): Promise<LlmResult<T>> {
  const model = configuredGeminiModel();
  const client = new GoogleGenAI({ apiKey: apiKey() });
  const startedAt = Date.now();
  const value = await withRetry(options.stage, model, async () => {
    const response = await client.models.generateContent({
      model,
      contents: options.contents,
      config: {
        systemInstruction: options.systemInstruction,
        temperature: options.temperature ?? 0.1,
        maxOutputTokens: options.maxOutputTokens ?? 4096,
        ...(options.responseSchema ? {
          responseMimeType: "application/json",
          responseSchema: options.responseSchema,
        } : {}),
        httpOptions: { timeout: DEFAULT_TIMEOUT_MS },
      },
    });
    const text = response.text?.trim() ?? "";
    if (!text) throw new Error(`Gemini returned an empty response for ${options.stage}`);
    if (!options.responseSchema) return text as T;
    const parsed = parseJson(text);
    return options.validate ? options.validate(parsed) : parsed as T;
  });
  return { value, model, latencyMs: Date.now() - startedAt };
}

/** Embedding gateway with the same transient retry policy. */
export async function embedWithGemini(texts: string[], stage = "embedding") {
  if (!texts.length) return [] as number[][];
  const model = process.env.GEMINI_EMBEDDING_MODEL?.trim() || "gemini-embedding-001";
  const client = new GoogleGenAI({ apiKey: apiKey() });
  return withRetry(stage, model, async () => {
    const response = await client.models.embedContent({
      model,
      contents: texts,
      config: {
        taskType: "RETRIEVAL_DOCUMENT",
        outputDimensionality: 768,
        httpOptions: { timeout: DEFAULT_TIMEOUT_MS },
      },
    });
    const vectors = response.embeddings?.map(embedding => embedding.values ?? []) ?? [];
    if (vectors.length !== texts.length || vectors.some(vector => vector.length !== 768)) {
      throw new Error("Gemini returned an invalid embedding response");
    }
    return vectors;
  });
}
