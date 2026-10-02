import DocumentRoute from "@/components/desk/DocumentRoute";
import Page from "@/app/documents/[id]/attempts/page";
export default function DeskAttempts({ params }: { params: Promise<{ id: string }> }) { return <DocumentRoute params={params}><Page /></DocumentRoute>; }
