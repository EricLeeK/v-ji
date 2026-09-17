import { AppIcon } from "@/components/app-icon";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, getUserId } from "@/lib/supabase/server";
import { Input } from "@/components/ui/input";

const CATEGORIES = ["全部", "英语", "考研", "语文", "综合"];

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const uid = await getUserId();
  if (!uid) redirect("/login");
  const { q = "", category = "全部" } = await searchParams;
  const supabase = await createClient();
  let query = supabase.from("books").select("*").order("learner_count", { ascending: false });
  if (category !== "全部") query = query.eq("category", category);
  if (q.trim()) query = query.ilike("title", `%${q.trim()}%`);
  const { data: books } = await query;

  return (
    <div className="flex flex-1 flex-col px-5 pt-6">
      <h1 className="text-2xl font-semibold">社区</h1>
      <form className="mt-4" action="/library" method="get">
        <Input name="q" defaultValue={q} placeholder="搜索卡册、学科、考试" aria-label="搜索卡册" />
      </form>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map((item) => (
          <Link
            key={item}
            href={item === "全部" ? "/library" : `/library?category=${item}`}
            className={`rounded-full px-3 py-1 text-xs ${
              category === item ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {item}
          </Link>
        ))}
      </div>
      <ul className="mt-4 space-y-3 pb-8">
        {(books ?? []).map((book) => (
          <li key={book.id}>
            <Link href={`/library/${book.id}`} className="flex gap-3 rounded-3xl bg-white p-4">
              <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-2xl">
                <AppIcon name="library" className="size-8 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-medium">{book.title}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                  {book.description}
                </p>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {book.learner_count.toLocaleString()} 人在学 · {book.is_free ? "免费" : "付费"}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
