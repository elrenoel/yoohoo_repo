import DocumentRoute from "@/components/desk/DocumentRoute";
import Page from "@/app/documents/[id]/attempts/[attemptId]/page";
export default function DeskAttemptReview({ params }: { params: Promise<{ id: string; attemptId: string }> }) { return <DocumentRoute params={params.then(({ id }) => ({ id }))}><Page /></DocumentRoute>; }
