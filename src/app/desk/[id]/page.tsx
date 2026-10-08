import DeckWorkbenchPage from "@/app/decks/[id]/page";
import PublicDeckExperience from "@/components/public-deck/PublicDeckExperienceView";
import PublicDeckSocial from "@/components/public-deck/PublicDeckSocial";

export default async function DeskDeckPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ share?: string }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (query.share === "1") return <><PublicDeckExperience slug={id}/><PublicDeckSocial slug={id}/></>;
  return <DeckWorkbenchPage/>;
}
