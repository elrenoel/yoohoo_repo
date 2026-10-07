import DocumentRoute from "@/components/desk/DocumentRoute";
import GenerateFlashcardsPage from "@/components/documents/GenerateFlashcardsPage";
export default function DeskGenerate({ params }: { params: Promise<{ id: string }> }) { return <DocumentRoute params={params}><GenerateFlashcardsPage /></DocumentRoute>; }
