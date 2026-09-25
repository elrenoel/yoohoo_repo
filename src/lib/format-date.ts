/**
 * Client-side date/time formatting helpers.
 *
 * Backend timestamps (`created_at` in `documents` / `quiz_attempts`) are stored
 * by Postgres as `timestamp` WITHOUT time zone, so they reach the browser as
 * naive strings like "2026-08-18 07:30:00" (server/UTC wall-clock). `new Date()`
 * would interpret such a string as LOCAL time, shifting the display by the
 * user's UTC offset. These helpers parse those strings as UTC and then render
 * them in the browser's own timezone, so every user sees times that are correct
 * for where they are — no hardcoded WIB/UTC.
 */

const NAIVE_TIMESTAMP_REGEX =
  /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?$/;

/**
 * Resolve the browser's current timezone (e.g. "Asia/Jakarta", "America/New_York").
 * Used as the explicit `timeZone` for `Intl.DateTimeFormat`.
 */
export function getBrowserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/**
 * Parse a server/DB timestamp into a `Date`.
 *
 * - Naive strings without a timezone designator ("2026-08-18 07:30:00") are
 *   interpreted as UTC (what the server stored), NOT as local time.
 * - ISO strings with "Z" or an offset, `Date` instances, and epoch numbers are
 *   parsed as-is.
 * - Invalid input yields an invalid `Date`; callers should check with `isNaN`.
 */
export function parseServerTimestamp(value: string | Date | number): Date {
  if (value instanceof Date) return new Date(value.getTime());
  if (typeof value === "number") return new Date(value);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (NAIVE_TIMESTAMP_REGEX.test(trimmed)) {
      // "YYYY-MM-DD HH:mm:ss" → treat as UTC
      return new Date(trimmed.replace(" ", "T") + "Z");
    }
    return new Date(trimmed);
  }
  return new Date(NaN);
}

interface FormatDateTimeOptions {
  /** Display locale, default "id-ID" */
  locale?: string | string[];
  day?: "numeric" | "2-digit";
  month?: "numeric" | "2-digit" | "long" | "short" | "narrow";
  year?: "numeric" | "2-digit";
  hour?: "numeric" | "2-digit";
  minute?: "numeric" | "2-digit";
  second?: "numeric" | "2-digit";
}

/**
 * Format a server timestamp for display, converted to the browser's timezone.
 * Falls back to the raw input string when the value cannot be parsed.
 */
export function formatDateTime(
  value: string | Date | number,
  options: FormatDateTimeOptions = {}
): string {
  const {
    locale = "id-ID",
    day = "numeric",
    month = "long",
    year = "numeric",
    hour = "2-digit",
    minute = "2-digit",
    ...rest
  } = options;

  try {
    const date = parseServerTimestamp(value);
    if (isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat(locale, {
      timeZone: getBrowserTimeZone(),
      day,
      month,
      year,
      hour,
      minute,
      ...rest,
    }).format(date);
  } catch {
    return String(value);
  }
}
