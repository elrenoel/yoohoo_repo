import DocumentRoute from "@/components/desk/DocumentRoute";
import Page from "@/app/documents/[id]/quiz/results/page";
export default function DeskQuizResults({ params }: { params: Promise<{ id: string }> }) { return <DocumentRoute params={params}><Page /></DocumentRoute>; }
