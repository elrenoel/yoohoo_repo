export const MAX_PDF_BYTES = 100 * 1024 * 1024;
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export interface Keyword { term: string; snippet: string }
export interface Chunk { chunkIndex: number; pageStart: number; pageEnd: number; content: string; scanPages: number[] }

export function chunkPages(pages: string[], size = 5): Chunk[] {
  if (!Number.isInteger(size) || size < 5 || size > 10) throw new Error("Chunk size must be 5–10 pages");
  if (!pages.length || pages.length > 6000) throw new Error("PDF must have 1–6000 pages");
  const chunks: Chunk[] = [];
  for (let start = 0; start < pages.length; start += size) {
    const group = pages.slice(start, start + size);
    chunks.push({ chunkIndex: chunks.length, pageStart: start + 1, pageEnd: start + group.length,
      content: group.join("\n\n"), // Preserve all extracted text. No word truncation.
      scanPages: group.flatMap((text, i) => text.trim().split(/\s+/).filter(Boolean).length < 20 ? [start + i + 1] : []) });
  }
  return chunks;
}

export function normalizeTerm(term: string) { return term.trim().toLowerCase(); }
export function parseKeywords(raw: string): Keyword[] {
  const data: unknown = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, ""));
  if (!Array.isArray(data)) throw new Error("Keyword output must be an array");
  const seen = new Set<string>();
  const result: Keyword[] = [];
  for (const item of data) {
    if (!item || typeof item.term !== "string" || typeof item.snippet !== "string") continue;
    const term = item.term.trim(), snippet = item.snippet.trim(), key = normalizeTerm(term);
    if (!term || term.length > 250 || snippet.length < 5 || snippet.length > 2000 || seen.has(key)) continue;
    seen.add(key); result.push({ term, snippet });
  }
  if (!result.length) throw new Error("No valid keywords returned");
  return result;
}

export class RagError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
