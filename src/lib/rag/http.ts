import "server-only";
import { auth } from "@/lib/auth";
import { RagError, UUID } from "./core";

export async function sessionUser(request: Request) {
  if (request.method !== "GET") {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin && origin !== process.env.BETTER_AUTH_URL && origin !== process.env.NEXT_PUBLIC_APP_URL) throw new RagError("Origin tidak diizinkan.", 403);
  }
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) throw new RagError("Silakan login terlebih dahulu.", 401);
  return session.user.id;
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
  if (error instanceof RagError) return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof Error) console.error("[RAG API]", { errorType: error.name, message: error.message, code: (error as { code?: string }).code, detail: (error as { detail?: string }).detail });
  else console.error("[RAG API]", error);
  return Response.json({ error: "Pemrosesan gagal. Coba lagi beberapa saat lagi." }, { status: 500 });
}
