import { redirect } from "next/navigation";
export default function StarredPage() { redirect("/history?filter=starred"); }
