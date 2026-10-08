import { redirect } from "next/navigation";

export default function EditPostPage() {
  redirect("/home?compose=1");
}
