import { createIsomorphicCanvasFactory, extractText, getDocumentProxy, renderPageAsImage } from "unpdf";
import { chunkPages } from "./core";

export async function extractChunks(bytes: Uint8Array) {
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  try {
    const { text } = await extractText(pdf, { mergePages: false });
    return { pageCount: pdf.numPages, chunks: chunkPages(text, Number(process.env.RAG_CHUNK_PAGES ?? 5)) };
  } finally { await pdf.loadingTask.destroy(); }
}

export async function renderScanPages(bytes: Uint8Array, pages: number[]) {
  const canvasImport = () => import("@napi-rs/canvas");
  const CanvasFactory = await createIsomorphicCanvasFactory(canvasImport);
  const pdf = await getDocumentProxy(new Uint8Array(bytes), { CanvasFactory });
  const images: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    for (const page of pages) {
      const image = new Uint8Array(await renderPageAsImage(pdf, page, { width: 1400, canvasImport }));
      totalBytes += image.length;
      // Inline images become base64; leave space under the Gemini request limit.
      if (totalBytes > 12 * 1024 * 1024) throw new Error("Rendered scan chunk exceeds image budget");
      images.push(image);
    }
    return images;
  } finally { await pdf.loadingTask.destroy(); }
}
