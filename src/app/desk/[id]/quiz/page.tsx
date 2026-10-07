import DocumentRoute from "@/components/desk/DocumentRoute";
import QuizPage from "@/components/documents/QuizPage";
export default function DeskQuiz({ params }: { params: Promise<{ id: string }> }) { return <DocumentRoute params={params}><QuizPage /></DocumentRoute>; }
