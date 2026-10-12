import "server-only";
import { AuthGuardError, requireSession } from "@/lib/auth-guard";
import { RagError, UUID } from "./core";

export async function sessionUser(request: Request) {
  try { return (await requireSession(request)).userId; }
  catch (error) {
    if (error instanceof AuthGuardError) throw new RagError(error.code, error.status);
    throw error;
  }
}
export function documentId(id: unknown): string {
  if (typeof id !== "string" || !UUID.test(id)) throw new RagError("ID dokumen tidak valid.");
  return id;
}
export async function jsonBody(request: Request) {
  if (Number(request.headers.get("content-length")) > 512 * 1024) throw new RagError("Payload terlalu besar.", 413);
  const text = await request.text();
  if (text.length > 512 * 1024) throw new RagError("Payload terlalu besar.", 413);
  try {
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected object");
    return value as Record<string, unknown>;
  } catch { throw new RagError("JSON tidak valid."); }
}
export function ragResponseError(error: unknown) {
  if (error instanceof AuthGuardError) return Response.json({ error: error.code }, { status: error.status });
  if (error instanceof RagError) return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof Error) console.error("[RAG API]", { errorType: error.name, message: error.message, code: (error as { code?: string }).code, detail: (error as { detail?: string }).detail });
  else console.error("[RAG API]", error);
  return Response.json({ error: "Pemrosesan gagal. Coba lagi beberapa saat lagi." }, { status: 500 });
}
