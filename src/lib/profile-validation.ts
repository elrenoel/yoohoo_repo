import { z } from "zod";

export const RESERVED_USERNAMES = new Set([
  "admin", "administrator", "api", "auth", "d", "deck", "decks", "desk",
  "explore", "help", "home", "jelajah", "login", "logout", "notifications",
  "p", "profile", "register", "settings", "support", "system", "tulis", "u",
  "user", "users", "yoohoo",
]);

export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export const usernameSchema = z
  .string()
  .transform(normalizeUsername)
  .pipe(z.string().regex(USERNAME_PATTERN, "Username harus 3–20 karakter: huruf kecil, angka, atau underscore."))
  .refine((value) => !RESERVED_USERNAMES.has(value), "Username ini tidak dapat digunakan.");

const profileFields = {
  username: usernameSchema,
  displayName: z.string().trim().min(1, "Nama tampilan wajib diisi.").max(50, "Nama tampilan maksimal 50 karakter."),
  bio: z.string().trim().max(160, "Bio maksimal 160 karakter.").default(""),
  avatarUrl: z.union([z.url("URL avatar tidak valid."), z.literal(""), z.null()]).optional(),
};

export const createProfileSchema = z.object(profileFields).strict();

export const updateProfileSchema = z.object({
  username: profileFields.username.optional(),
  displayName: profileFields.displayName.optional(),
  bio: z.string().trim().max(160, "Bio maksimal 160 karakter.").optional(),
  avatarUrl: profileFields.avatarUrl,
  userId: z.string().optional(),
  user_id: z.string().optional(),
}).strict().refine(
  (value) => value.username !== undefined || value.displayName !== undefined || value.bio !== undefined || value.avatarUrl !== undefined,
  "Tidak ada perubahan untuk disimpan.",
);

export type ProfileInput = z.infer<typeof createProfileSchema>;
export type ProfileUpdateInput = z.infer<typeof updateProfileSchema>;
