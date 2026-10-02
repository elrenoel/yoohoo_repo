import type { ReactNode } from "react";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import AppShell from "@/components/layout/AppShell";
import DocumentWorkspaceHeader from "@/components/layout/DocumentWorkspaceHeader";

export const dynamic = "force-dynamic";

export default async function DocumentWorkspaceLayout({
  children,
  params,
  withShell = true,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
  withShell?: boolean;
}) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  let title = "Dokumen";
  let pageCount: number | null = null;

  if (session?.user) {
    const result = await db
      .from("documents")
      .select("title,page_count")
      .eq("id", id)
      .eq("user_id", session.user.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (result.data) {
      title = result.data.title;
      pageCount = result.data.page_count;
    }
  }

  const content = (
    <div className="min-h-screen bg-[#fafafa] pb-24 text-neutral-900 lg:pb-0">
        <DocumentWorkspaceHeader documentId={id} title={title} pageCount={pageCount} />
        {children}
    </div>
  );
  return withShell ? <AppShell>{content}</AppShell> : content;
}
