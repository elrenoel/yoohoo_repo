import type { ReactNode } from "react";
import DeskWorkspaceNav from "@/components/desk/DeskWorkspaceNav";
export default async function DocumentRoute({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <><DeskWorkspaceNav deckId={id} />{children}</>;
}
