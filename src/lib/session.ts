import { v4 as uuidv4 } from "uuid";

const SESSION_STORAGE_KEY = "yoohoo_guest_session_id";

/**
 * Mendapatkan session ID guest saat ini atau membuat yang baru jika belum ada di localStorage.
 */
export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") {
    return "";
  }

  let sessionId = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!sessionId) {
    sessionId = uuidv4();
    localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  }
  return sessionId;
}

/**
 * Mengambil session ID guest jika ada.
 */
export function getSessionId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return localStorage.getItem(SESSION_STORAGE_KEY);
}

/**
 * Menghapus session ID guest (misal untuk reset).
 */
export function clearSessionId(): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.removeItem(SESSION_STORAGE_KEY);
}
