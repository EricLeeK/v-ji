import { AppIcon } from "@/components/app-icon";
import { notFound, redirect } from "next/navigation";
import { JoinBookButton } from "@/components/library/join-book-button";
import { createClient, getUserId } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";

const MARK: Record<string, string> = { star: "star", diamond: "diamond", hollow: "star", normal: "dot" };

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
  const chapters = [...new Set((notes ?? []).map((note) => note.chapter ?? "未分类"))];

  return (
    <div className="flex flex-1 flex-col px-5 pt-6 pb-8">
      <div className="rounded-[28px] bg-white p-5">
        <div className="text-4xl"><AppIcon name="library" className="size-10 text-primary" /></div>
        <h1 className="mt-3 text-2xl font-semibold">{book.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{book.author}</p>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{book.description}</p>
        <div className="mt-3 flex gap-2">
          <Badge variant="secondary">{book.category}</Badge>
          <Badge variant="secondary">{book.learner_count.toLocaleString()} 人在学</Badge>
          <Badge>{book.is_free ? "免费" : "付费"}</Badge>
        </div>
      </div>

      <section className="mt-5">
        <h2 className="mb-2 text-sm font-semibold">目录</h2>
        <ul className="space-y-2">
          {(toc as Array<{ title?: string; importance?: string; count?: number }>).map((item, index) => (
            <li key={index} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm">
              <span>
                <span className="mr-2 text-amber-500"><AppIcon name={MARK[item.importance ?? "normal"] ?? "dot"} className="inline size-4" /></span>
                {item.title}
              </span>
              <span className="text-xs text-muted-foreground">{item.count} 张</span>
            </li>
          ))}
          {toc.length === 0
            ? chapters.map((chapter) => (
                <li key={chapter} className="rounded-2xl bg-white px-4 py-3 text-sm">
                  {chapter}
                </li>
              ))
            : null}
        </ul>
      </section>

      {!book.is_free ? (
        <section className="mt-5 rounded-3xl border border-dashed p-4 text-sm text-muted-foreground">
          拼团 / 购买将在后续版本接入。当前卡册可免费加入学习。
        </section>
      ) : null}

      <div className="mt-6">
        <JoinBookButton bookId={book.id} already={!!joined} />
      </div>
    </div>
  );
}
