import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { db } from "@/db";
import { sessionUser, ragResponseError } from "@/lib/rag/http";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const AVATAR_BUCKET = "profile-avatars";
const MAX_UPLOAD_BYTES = 1024 * 1024;

function detectedType(buffer: Buffer) {
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  return null;
}

async function ensureAvatarBucket() {
  const { data } = await db.storage.getBucket(AVATAR_BUCKET);
  if (data) return;

  const { error } = await db.storage.createBucket(AVATAR_BUCKET, {
    public: true,
    fileSizeLimit: MAX_UPLOAD_BYTES,
    allowedMimeTypes: ["image/webp"],
  });
  if (error && !/already exists/i.test(error.message)) throw error;
}

export async function POST(request: Request) {
  try {
    const userId = await sessionUser(request);
    if (!checkRateLimit(`profile-avatar:${userId}`, 10, 10 * 60_000).allowed) {
      return Response.json({ error: "Terlalu banyak upload foto. Coba lagi sebentar." }, { status: 429 });
    }
    if (Number(request.headers.get("content-length")) > MAX_UPLOAD_BYTES + 256 * 1024) {
      return Response.json({ error: "Hasil foto maksimal 1 MB." }, { status: 413 });
    }
    const form = await request.formData();
    const file = form.get("avatar");

    if (!(file instanceof File)) {
      return Response.json({ error: "Pilih foto profil terlebih dahulu." }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return Response.json({ error: "Hasil foto maksimal 1 MB." }, { status: 413 });
    }

    const input = Buffer.from(await file.arrayBuffer());
    const contentType = detectedType(input);
    if (!contentType || contentType !== file.type) {
      return Response.json({ error: "Hasil foto harus berupa WebP atau JPEG yang valid." }, { status: 400 });
    }
    const image = sharp(input, {
      animated: false,
      limitInputPixels: 40_000_000,
    });
    const metadata = await image.metadata();
    if (metadata.width !== 512 || metadata.height !== 512) {
      return Response.json({ error: "Ukuran hasil crop harus 512×512 piksel." }, { status: 400 });
    }
    const avatar = contentType === "image/webp" ? await image.toBuffer() : await image.webp({ quality: 85 }).toBuffer();

    await ensureAvatarBucket();
    const path = `${userId}/${randomUUID()}.webp`;
    const { error } = await db.storage.from(AVATAR_BUCKET).upload(path, avatar, {
      contentType: "image/webp",
      cacheControl: "31536000",
      upsert: false,
    });
    if (error) throw error;

    const { data } = db.storage.from(AVATAR_BUCKET).getPublicUrl(path);
    return Response.json({ avatarUrl: data.publicUrl }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && /unsupported image|Input buffer|pixel limit/i.test(error.message)) {
      return Response.json({ error: "File foto tidak valid atau rusak." }, { status: 400 });
    }
    return ragResponseError(error);
  }
}
