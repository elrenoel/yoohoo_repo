import DocumentRoute from "@/components/desk/DocumentRoute";
import QuizResultsPage from "@/components/documents/QuizResultsPage";
export default function DeskQuizResults({ params }: { params: Promise<{ id: string }> }) { return <DocumentRoute params={params}><QuizResultsPage /></DocumentRoute>; }
