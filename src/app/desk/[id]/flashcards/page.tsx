import DocumentRoute from "@/components/desk/DocumentRoute";
import Page from "@/app/documents/[id]/flashcards/page";
export default function DeskFlashcards({ params }: { params: Promise<{ id: string }> }) { return <DocumentRoute params={params}><Page /></DocumentRoute>; }
