import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { handleApiError } from "@/lib/api-error";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params;
    if (!UUID.test(id)) return NextResponse.json({ success: false, error: "ID dokumen tidak valid." }, { status: 400 });
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return NextResponse.json({ success: false, error: "Silakan masuk terlebih dahulu.", requireAuth: true }, { status: 401 });
    const body = await request.json().catch(() => ({})) as { is_starred?: unknown };
    if (typeof body.is_starred !== "boolean") return NextResponse.json({ success: false, error: "is_starred harus boolean." }, { status: 400 });
    const result = await db.from("documents").update({ is_starred: body.is_starred, starred_at: body.is_starred ? new Date().toISOString() : null })
      .eq("id", id).eq("user_id", session.user.id).is("deleted_at", null)
      .select("id,is_starred,starred_at").maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) return NextResponse.json({ success: false, error: "Dokumen tidak ditemukan." }, { status: 404 });
    return NextResponse.json({ success: true, isStarred: result.data.is_starred, starredAt: result.data.starred_at });
  } catch (error) { return handleApiError(error, "PATCH /api/documents/:id/star"); }
}
