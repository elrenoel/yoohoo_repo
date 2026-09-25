import dotenv from "dotenv";
import { readFile } from "node:fs/promises";
import { samplePdf } from "./rag-fixture";
import { extractChunks, renderScanPages } from "../src/lib/rag/pdf";
import { extractKeywords } from "../src/lib/rag/ai";
dotenv.config({ path: ".env.local", quiet: true });

async function main() {
  const fileArg = process.argv.find(arg => arg.startsWith("--pdf="));
  const bytes = fileArg ? new Uint8Array(await readFile(fileArg.slice(6))) : samplePdf();
  if (process.argv.includes("--local-ai")) {
    const { pageCount, chunks } = await extractChunks(bytes);
    if (chunks.some(c => c.scanPages.length)) throw new Error("Use AWS smoke for scan documents or the default text fixture");
    const vision = process.argv.includes("--vision");
    const keywords = (await Promise.all(chunks.map(async c => {
      const images = vision ? await renderScanPages(bytes, Array.from({ length: c.pageEnd - c.pageStart + 1 }, (_, i) => c.pageStart + i)) : [];
      return extractKeywords(vision ? "" : c.content, images);
    }))).flat();
    console.log(JSON.stringify({ mode: `local PDF + real Gemini ${vision ? "Vision" : "text"} (no AWS or database)`, pageCount, chunks: chunks.length, keywords }, null, 2));
    return;
  }
  const base = process.env.RAG_TEST_BASE_URL ?? "http://localhost:3000";
  const cookie = process.env.RAG_TEST_SESSION_COOKIE;
  if (!cookie) throw new Error("Set RAG_TEST_SESSION_COOKIE from a dedicated test user's Better Auth session; never paste it into logs");
  const headers = { "Content-Type": "application/json", Cookie: cookie, Origin: new URL(base).origin };
  async function api(path: string, body?: unknown, method = "POST") {
    const response = await fetch(base + path, { method: body === undefined ? "GET" : method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) throw new Error(`${path}: ${result.error ?? response.status}`);
    return result;
  }
  const signed = await api("/api/documents/presign", { filename: "rag-smoke.pdf", contentType: "application/pdf", fileSize: bytes.length });
  const put = await fetch(signed.uploadUrl, { method: "PUT", headers: signed.headers, body: Buffer.from(bytes) });
  if (!put.ok) throw new Error(`S3 upload failed: ${put.status}`);
  await api("/api/documents/confirm", { documentId: signed.documentId, filename: "rag-smoke.pdf", title: "RAG smoke test" });
  console.log("Uploaded test document:", signed.documentId);
  for (let attempt = 0; attempt < 180; attempt++) {
    const snapshot = await api(`/api/documents/${signed.documentId}/keywords`);
    console.log(snapshot.document.status, snapshot.progress);
    if (snapshot.document.status === "failed") throw new Error(snapshot.document.errorMessage);
    if (snapshot.document.status === "ready_for_selection") {
      const ids = snapshot.keywords.slice(0, 2).map((k: { id: string }) => k.id);
      const result = await api(`/api/documents/${signed.documentId}/keywords`, { selectedIds: ids }, "PATCH");
      const saved = await api(`/api/documents/${signed.documentId}/keywords`);
      if (saved.keywords.filter((k: { isSelected: boolean }) => k.isSelected).length !== ids.length) throw new Error("Selection persistence failed");
      console.log("PASS", { documentId: signed.documentId, keywordCount: snapshot.keywords.length, ...result });
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  throw new Error("Timed out waiting for pipeline");
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Smoke failed"); process.exitCode = 1; });
