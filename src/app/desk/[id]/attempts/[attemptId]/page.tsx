import DocumentRoute from "@/components/desk/DocumentRoute";
import AttemptDetailPage from "@/components/documents/AttemptDetailPage";
export default function DeskAttemptReview({ params }: { params: Promise<{ id: string; attemptId: string }> }) { return <DocumentRoute params={params.then(({ id }) => ({ id }))}><AttemptDetailPage /></DocumentRoute>; }
