import DocumentRoute from "@/components/desk/DocumentRoute";
import AttemptsPage from "@/components/documents/AttemptsPage";
export default function DeskAttempts({ params }: { params: Promise<{ id: string }> }) { return <DocumentRoute params={params}><AttemptsPage /></DocumentRoute>; }
