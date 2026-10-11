import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { db } from "@/db";
import { sessionUser, ragResponseError } from "@/lib/rag/http";

export const runtime = "nodejs";

const AVATAR_BUCKET = "profile-avatars";
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

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
    if (Number(request.headers.get("content-length")) > MAX_UPLOAD_BYTES + 256 * 1024) {
      return Response.json({ error: "Ukuran foto maksimal 4 MB." }, { status: 413 });
    }
    const form = await request.formData();
    const file = form.get("avatar");

    if (!(file instanceof File)) {
      return Response.json({ error: "Pilih foto profil terlebih dahulu." }, { status: 400 });
    }
    if (!ACCEPTED_TYPES.has(file.type)) {
      return Response.json({ error: "Gunakan foto JPG, PNG, WebP, atau GIF." }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return Response.json({ error: "Ukuran foto maksimal 4 MB." }, { status: 413 });
    }

    const avatar = await sharp(Buffer.from(await file.arrayBuffer()), {
      animated: false,
      limitInputPixels: 40_000_000,
    })
      .rotate()
      .resize(512, 512, { fit: "cover", position: "attention", withoutEnlargement: true })
      .webp({ quality: 84 })
      .toBuffer();

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
