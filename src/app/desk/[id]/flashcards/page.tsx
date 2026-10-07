import DocumentRoute from "@/components/desk/DocumentRoute";
import FlashcardsPage from "@/components/documents/FlashcardsPage";
export default function DeskFlashcards({ params }: { params: Promise<{ id: string }> }) { return <DocumentRoute params={params}><FlashcardsPage /></DocumentRoute>; }
