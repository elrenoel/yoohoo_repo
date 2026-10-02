import { classifyAndSelectCoreKeywords } from "@/lib/rag/core-keywords";
import { documentId, ragResponseError, sessionUser } from "@/lib/rag/http";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = await sessionUser(request);
    const deckId = documentId((await context.params).id);
    return Response.json(await classifyAndSelectCoreKeywords(deckId, userId));
  } catch (error) {
    return ragResponseError(error);
  }
}
