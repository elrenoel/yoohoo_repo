export const MAX_PDF_BYTES = 100 * 1024 * 1024;
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export interface Keyword { term: string; snippet: string }
export interface Chunk { chunkIndex: number; pageStart: number; pageEnd: number; content: string; scanPages: number[] }

function trailingParagraphs(text: string, count: number) {
  const paragraphs = text.split(/\n\s*\n+/).map(paragraph => paragraph.trim()).filter(Boolean);
  return paragraphs.slice(-count).join("\n\n");
}

export function chunkPages(pages: string[], size = 5, overlapParagraphs = 2): Chunk[] {
  if (!Number.isInteger(size) || size < 5 || size > 10) throw new Error("Chunk size must be 5–10 pages");
  if (!Number.isInteger(overlapParagraphs) || overlapParagraphs < 1 || overlapParagraphs > 2) throw new Error("Chunk overlap must be 1–2 paragraphs");
  if (!pages.length || pages.length > 6000) throw new Error("PDF must have 1–6000 pages");
  const chunks: Chunk[] = [];
  let previousSource = "";
  for (let start = 0; start < pages.length; start += size) {
    const group = pages.slice(start, start + size);
    const source = group.join("\n\n");
    const overlap = chunks.length ? trailingParagraphs(previousSource, overlapParagraphs) : "";
    chunks.push({ chunkIndex: chunks.length, pageStart: start + 1, pageEnd: start + group.length,
      // Overlap preserves concepts split at the page-group boundary without changing page ownership.
      content: overlap ? `${overlap}\n\n${source}` : source,
      scanPages: group.flatMap((text, i) => text.trim().split(/\s+/).filter(Boolean).length < 20 ? [start + i + 1] : []) });
    previousSource = source;
  }
  return chunks;
}

export function normalizeTerm(term: string) { return term.trim().toLowerCase(); }
function comparableWords(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(/\s+/).filter(Boolean);
}
export function isSnippetEcho(term: string, snippet: string) {
  const termWords = comparableWords(term), snippetWords = comparableWords(snippet);
  if (!termWords.length || !snippetWords.length) return true;
  if (termWords.join(" ") === snippetWords.join(" ")) return true;
  const remaining = [...snippetWords];
  for (const word of termWords) {
    const index = remaining.indexOf(word);
    if (index >= 0) remaining.splice(index, 1);
  }
  // A term plus one or two label words is not a standalone explanation.
  return remaining.length <= 2 && snippetWords.length <= termWords.length + 2;
}
export function parseKeywords(raw: string): Keyword[] {
  const data: unknown = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, ""));
  if (!Array.isArray(data)) throw new Error("Keyword output must be an array");
  const seen = new Set<string>();
  const result: Keyword[] = [];
  for (const item of data) {
    if (!item || typeof item.term !== "string" || typeof item.snippet !== "string") continue;
    const term = item.term.trim(), snippet = item.snippet.trim(), key = normalizeTerm(term);
    if (!term || term.length > 250 || snippet.length < 20 || snippet.length > 2000 || comparableWords(snippet).length < 4 || seen.has(key)) continue;
    seen.add(key); result.push({ term, snippet });
  }
  return result;
}

export class RagError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
