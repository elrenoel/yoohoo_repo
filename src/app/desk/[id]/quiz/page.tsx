import DocumentRoute from "@/components/desk/DocumentRoute";
import Page from "@/app/documents/[id]/quiz/page";
export default function DeskQuiz({ params }: { params: Promise<{ id: string }> }) { return <DocumentRoute params={params}><Page /></DocumentRoute>; }
