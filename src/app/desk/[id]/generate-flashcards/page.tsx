import DocumentRoute from "@/components/desk/DocumentRoute";
import Page from "@/app/documents/[id]/generate-flashcards/page";
export default function DeskGenerate({ params }: { params: Promise<{ id: string }> }) { return <DocumentRoute params={params}><Page /></DocumentRoute>; }
