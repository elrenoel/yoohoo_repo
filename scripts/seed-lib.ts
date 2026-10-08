import { config } from "dotenv";
import postgres, { type Sql, type TransactionSql } from "postgres";
import { z } from "zod";
import { v5 as uuidv5 } from "uuid";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

export const SEED_NAMESPACE = "43f767d2-cbcb-4f9c-9a20-c74fb5d490d3";
export const USER_COUNT = 50;
export const DB_LIMIT = 350 * 1024 * 1024;
export const DB_DELTA_LIMIT = 50 * 1024 * 1024;
export const id = (key: string) => uuidv5(`yoohoo-demo:${key}`, SEED_NAMESPACE);

const cardSchema = z.object({ front: z.string().min(1).max(500), back: z.string().min(1).max(2000) });
const questionSchema = z.object({
  question: z.string().min(1).max(1000), options: z.array(z.string().min(1).max(500)).length(4),
  correct_index: z.number().int().min(0).max(3), explanation: z.string().min(1).max(2000),
});
const deckSchema = z.object({
  title: z.string().min(1).max(120), description: z.string().min(1).max(500),
  tags: z.array(z.string().min(1).max(30)).min(2).max(4).transform(v => v.map(x => x.toLowerCase())),
  language: z.literal("id"), cards: z.array(cardSchema).min(8).max(12), questions: z.array(questionSchema).min(5).max(8),
});
export const seedUserSchema = z.object({
  display_name: z.string().min(1).max(50), username: z.string().regex(/^[a-z0-9_]{3,20}$/),
  bio: z.string().min(1).max(160), decks: z.array(deckSchema).length(2),
  caption: z.string().min(1).max(500), post_tags: z.array(z.string().min(1).max(30)).max(3).transform(v => v.map(x => x.toLowerCase())),
  image_spec: z.object({ title: z.string().min(1).max(80), points: z.array(z.string().min(1).max(120)).min(4).max(6) }).optional(),
});
export type SeedUser = z.infer<typeof seedUserSchema>;

export const INTERESTS = [
  "Astronomi", "Aljabar Linear", "JavaScript", "Bahasa Inggris", "Ekonomi Mikro", "Manajemen Proyek", "Biologi Sel", "Kimia Organik", "Sejarah Indonesia", "Hukum Dasar",
  "Akuntansi", "Desain Grafis", "Fisika Mekanika", "Statistika", "Python", "Public Speaking", "Makroekonomi", "Agile Scrum", "Genetika", "Kimia Analitik",
  "Sejarah Dunia", "Hukum Bisnis", "Keuangan Pribadi", "UI UX", "Geografi", "Kalkulus", "Basis Data", "Bahasa Jepang", "Kewirausahaan", "Kepemimpinan",
  "Ekologi", "Biokimia", "Sosiologi", "Etika Digital", "Audit", "Tipografi", "Meteorologi", "Teori Bilangan", "Keamanan Siber", "Bahasa Indonesia",
  "Pemasaran Digital", "Produktivitas", "Anatomi", "Ilmu Material", "Antropologi", "Hak Kekayaan Intelektual", "Investasi Dasar", "Fotografi", "Logika", "Machine Learning",
] as const;

export function assertSafeEnvironment() {
  if (process.env.NODE_ENV === "production") throw new Error("Seed ditolak: NODE_ENV=production.");
  const url = process.env.SUPABASE_DATABASE_URL?.trim();
  if (!url) throw new Error("SUPABASE_DATABASE_URL belum diatur.");
  if (process.env.SEED_DATABASE_CONFIRMED !== "development") {
    throw new Error("Set SEED_DATABASE_CONFIRMED=development untuk mengonfirmasi target bukan production.");
  }
  return url;
}

export function seedSql() {
  return postgres(assertSafeEnvironment(), { prepare: false, max: 3, idle_timeout: 10, connect_timeout: 15, ssl: "require" });
}

export async function databaseSize(sql: Sql | TransactionSql) {
  const rows = await sql<{ bytes: number }[]>`select pg_database_size(current_database())::bigint::float8 bytes`;
  return Number(rows[0].bytes);
}

export async function assertDatabaseCapacity(sql: Sql) {
  const bytes = await databaseSize(sql);
  if (bytes > DB_LIMIT) throw new Error(`Seed dihentikan: ukuran database ${formatBytes(bytes)} melebihi 350 MB.`);
  return bytes;
}

export const formatBytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;
export const chunks = <T>(values: T[], size = 500) => Array.from({ length: Math.ceil(values.length / size) }, (_, i) => values.slice(i * size, (i + 1) * size));
export const slugify = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "belajar";

export function rng(seed: number) {
  let state = seed >>> 0;
  return () => ((state = Math.imul(1664525, state) + 1013904223 >>> 0) / 4294967296);
}
