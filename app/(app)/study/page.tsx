import { redirect } from "next/navigation";
import { getStudyQueue } from "@/lib/data";
import { StudySession } from "@/components/study/study-session";

export default async function StudyPage({
  searchParams,
}: {
  searchParams: Promise<{ deckId?: string; shuffle?: string }>;
}) {
  const { deckId, shuffle } = await searchParams;
  const shuffleDeck = Boolean(deckId) && shuffle === "1";
  const data = await getStudyQueue(deckId, { shuffleDeck });
  if (!data) redirect("/login");
  return (
    <StudySession
      key={`${deckId ?? "today"}:${shuffleDeck ? "shuffle" : "order"}`}
      initialQueue={data.queue}
      settings={data.settings}
      scope={deckId ? "deck" : "today"}
      shuffled={shuffleDeck}
    />
  );
}
