import { redirect } from "next/navigation";import { getSocialViewer } from "@/lib/social-guard";
export default async function WriteLayout({children}:{children:React.ReactNode}){const{session}=await getSocialViewer();if(!session)redirect("/login");return children}
