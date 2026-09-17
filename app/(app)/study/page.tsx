import { redirect } from "next/navigation";
import { getStudyQueue } from "@/lib/data";
import { StudySession } from "@/components/study/study-session";

export default async function StudyPage({
  searchParams,
}: {
  searchParams: Promise<{ deckId?: string }>;
}) {
  const { deckId } = await searchParams;
  const data = await getStudyQueue(deckId);
  if (!data) redirect("/login");
  return <StudySession key={deckId ?? "today"} initialQueue={data.queue} settings={data.settings} scope={deckId ? "deck" : "today"} />;
}
