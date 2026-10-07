import PublicDeckExperience from "@/components/public-deck/PublicDeckExperience";
import PublicDeckSocial from "@/components/public-deck/PublicDeckSocial";
export default async function PublicDeckPage({params}:{params:Promise<{slug:string}>}){const {slug}=await params;return <><PublicDeckExperience slug={slug}/><PublicDeckSocial slug={slug}/></>}
