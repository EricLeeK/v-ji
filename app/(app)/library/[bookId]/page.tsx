import { BackLink } from "@/components/back-link";
import { AppIcon } from "@/components/app-icon";
import { notFound, redirect } from "next/navigation";
import { JoinBookButton } from "@/components/library/join-book-button";
import { createClient, getUserId } from "@/lib/supabase/server";
import { BookChapters } from "@/components/library/book-chapters";
import { Badge } from "@/components/ui/badge";

export default async function BookDetailPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const { bookId } = await params;
  const uid = await getUserId();
  if (!uid) redirect("/login");
  const supabase = await createClient();
  const [{ data: book }, { data: notes }, { data: joined }] = await Promise.all([
    supabase.from("books").select("*").eq("id", bookId).maybeSingle(),
    supabase.from("book_notes").select("*").eq("book_id", bookId).order("sort_order"),
    supabase.from("user_books").select("deck_id").eq("owner_id", uid).eq("book_id", bookId).maybeSingle(),
  ]);
  if (!book) notFound();

  const toc = Array.isArray(book.toc) ? book.toc : [];

  return (
    <div className="app-page flex flex-1 flex-col px-5 pt-7 pb-28">
      <BackLink href="/library" label="社区" />
      <div className="app-card rounded-[30px] p-5">
        <div className="text-4xl"><AppIcon name="library" className="size-10 text-primary" /></div>
        <h1 className="mt-3 text-xl font-semibold leading-snug [overflow-wrap:anywhere]">{book.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{book.author}</p>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{book.description}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant="secondary">{book.category}</Badge>
          {book.learner_count >= 1 ? <Badge variant="secondary">{book.learner_count.toLocaleString("zh-CN")} 人在学</Badge> : null}
          <Badge>免费加入</Badge>
        </div>
      </div>

      <section className="mt-5">
        <h2 className="mb-2 text-sm font-semibold">目录</h2>
        <BookChapters notes={notes ?? []} toc={toc as Array<{ title?: string; importance?: string; count?: number }>} />
      </section>

      <div className="mt-6">
        <JoinBookButton bookId={book.id} deckId={joined?.deck_id} />
      </div>
    </div>
  );
}
