import { NextResponse } from "next/server";

/**
 * Standard API error response format sent to clients.
 */
export interface ApiErrorResponse {
  success: false;
  error: string;
  code: string;
}

/**
 * Handle errors in API route handlers consistently.
 *
 * - Logs the real error (message + stack) to server console for debugging.
 * - Returns a safe, user-friendly response to the client — never leaks
 *   raw SQL, stack traces, or internal error details.
 *
 * @param error   The caught error
 * @param context A short label like "POST /api/documents/generate"
 * @param fallbackMessage  User-facing message (defaults to generic text)
 */
export function handleApiError(
  error: unknown,
  context: string,
  fallbackMessage = "Terjadi kesalahan server. Silakan coba beberapa saat lagi."
): NextResponse<ApiErrorResponse> {
  // Log the real error for server-side debugging
  if (error instanceof Error) {
    console.error(`[${context}] Error:`, error.message);
    if (error.stack) {
      console.error(`[${context}] Stack:`, error.stack);
    }
  } else {
    console.error(`[${context}] Unknown error:`, error);
  }

  return NextResponse.json(
    {
      success: false,
      error: fallbackMessage,
      code: "SERVER_ERROR",
    },
    { status: 500 }
  );
}

/**
 * Convenience: create a non-500 error response (e.g. validation, not-found).
 * For user-facing validation errors that already have specific messages.
 */
export function apiErrorResponse(
  message: string,
  status: number,
  code: string = "VALIDATION_ERROR"
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    { success: false, error: message, code },
    { status }
  );
}
