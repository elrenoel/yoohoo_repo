import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { markNotificationRead, markAllNotificationsRead } from "@/lib/jobs";
import { handleApiError } from "@/lib/api-error";
import { ragSql } from "@/lib/rag/db";
import { withApiTiming } from "@/lib/api-timing";

export const dynamic = "force-dynamic";

/**
 * GET /api/notifications
 * - Query params:
 *   - limit?: number (default 20)
 *   - offset?: number (default 0)
 *   - unread?: boolean (filter hanya notifikasi belum dibaca)
 * - Response: { notifications: [], total: number, unreadCount: number }
 */
export async function GET(request: NextRequest) {
  return withApiTiming(request, "GET /api/notifications", async (time) => {
   try {
    const session = await time("auth", () => auth.api.getSession({ headers: request.headers }));
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Silakan masuk (login) terlebih dahulu.", requireAuth: true },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const parsedLimit = Number.parseInt(searchParams.get("limit") || "20", 10);
    const limit = Number.isFinite(parsedLimit) ? Math.min(20, Math.max(1, parsedLimit)) : 20;
    const unreadOnly = searchParams.get("unread") === "true";
    const cursorParam = searchParams.get("cursor");
    if (cursorParam) {
      let cursor: { createdAt: string; id: string };
      try { cursor = JSON.parse(Buffer.from(cursorParam, "base64url").toString("utf8")); }
      catch { return NextResponse.json({ error: "Cursor tidak valid." }, { status: 400 }); }
      if (!cursor.createdAt || !cursor.id) return NextResponse.json({ error: "Cursor tidak valid." }, { status: 400 });
      const sql = ragSql();
      const rows = await time("db.notifications", () => sql`select id,type,severity,title,body,link,read_at,created_at,actor_id,target_type,target_id
        from public.notifications where user_id=${session.user.id}
        and (created_at,id)<(${cursor.createdAt},${cursor.id}) order by created_at desc,id desc limit 21`);
      const page = rows.slice(0,20), last = rows.length>20?page.at(-1):null;
      return NextResponse.json({ notifications: page, nextCursor: last ? Buffer.from(JSON.stringify({createdAt:new Date(last.created_at).toISOString(),id:String(last.id)})).toString("base64url") : null });
    }

    const sql = ragSql();
    const notifications = await time("db.notifications", () => sql`
      select id,type,severity,title,body,link,read_at,created_at,actor_id,target_type,target_id,
        count(*) filter (where read_at is null) over ()::int as unread_count
      from public.notifications
      where user_id=${session.user.id}
        ${unreadOnly ? sql`and read_at is null` : sql``}
      order by created_at desc,id desc limit ${limit}`);

    return NextResponse.json({
      success: true,
      notifications,
      total: notifications.length,
      unreadCount: Number(notifications[0]?.unread_count ?? 0),
      limit,
    });
  } catch (error) {
    return handleApiError(error, "GET /api/notifications");
  }
  });
}

/**
 * POST /api/notifications/read
 * - Body: { notificationId?: string } (kosongkan untuk menandai semua)
 * - Jika notificationId diberikan, tandai satu notifikasi sebagai read.
 * - Jika tidak, tandai semua notifikasi user sebagai read.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Silakan masuk (login) terlebih dahulu.", requireAuth: true },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({})) as { notificationId?: string };
    const { notificationId } = body;

    if (notificationId) {
      await markNotificationRead(notificationId, session.user.id);
      return NextResponse.json({
        success: true,
        message: "Notifikasi ditandai sebagai sudah dibaca.",
      });
    } else {
      await markAllNotificationsRead(session.user.id);
      return NextResponse.json({
        success: true,
        message: "Semua notifikasi ditandai sebagai sudah dibaca.",
      });
    }
  } catch (error) {
    return handleApiError(error, "POST /api/notifications/read");
  }
}
