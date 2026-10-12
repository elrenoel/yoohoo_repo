import "server-only";
import { auth } from "@/lib/auth";

export type AuthSession = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;
export type AuthContext = { session: AuthSession; userId: string };

export class AuthGuardError extends Error {
  constructor(public readonly status: 401 | 403 | 404, public readonly code: "UNAUTHENTICATED" | "INVALID_ORIGIN" | "NOT_FOUND") { super(code); }
}

function configuredOrigins(request: Request) {
  return new Set([new URL(request.url).origin, process.env.BETTER_AUTH_URL, process.env.NEXT_PUBLIC_APP_URL, process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined].filter((value): value is string => Boolean(value)));
}

export function assertTrustedOrigin(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
  const origin = request.headers.get("origin");
  if (origin && !configuredOrigins(request).has(origin)) throw new AuthGuardError(403, "INVALID_ORIGIN");
}

export async function getSessionOrNull(request: Request): Promise<AuthSession | null> {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user ? session : null;
}

export async function requireSession(request: Request): Promise<AuthContext> {
  assertTrustedOrigin(request);
  const session = await getSessionOrNull(request);
  if (!session) throw new AuthGuardError(401, "UNAUTHENTICATED");
  return { session, userId: session.user.id };
}

export function assertOwner(resourceOwnerId: string, sessionUserId: string): void {
  if (resourceOwnerId !== sessionUserId) throw new AuthGuardError(404, "NOT_FOUND");
}

export function authErrorResponse(error: unknown): Response | null {
  return error instanceof AuthGuardError ? Response.json({ error: error.code }, { status: error.status }) : null;
}

type AuthenticatedHandler<Args extends unknown[]> = (request: Request, authContext: AuthContext, ...args: Args) => Response | Promise<Response>;
export function withAuth<Args extends unknown[]>(handler: AuthenticatedHandler<Args>) {
  return async (request: Request, ...args: Args): Promise<Response> => {
    try { return await handler(request, await requireSession(request), ...args); }
    catch (error) { const response = authErrorResponse(error); if (response) return response; throw error; }
  };
}
