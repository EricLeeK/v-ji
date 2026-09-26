import { ArrowRight, ChevronRight, RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppIcon } from "@/components/app-icon";
import { EmptyState } from "@/components/empty-state";
import { FeaturedCardsArt } from "@/components/library/featured-cards-art";
import { LibrarySearchButton, LibrarySort } from "@/components/library/library-sort";
import { Input } from "@/components/ui/input";
import { createClient, getUserId } from "@/lib/supabase/server";

const CATEGORIES = ["全部", "英语", "考研", "语文", "综合"] as const;
const SORTS = [
  { value: "popular", label: "人气最高" },
  { value: "recent", label: "最新发布" },
] as const;

const BOOK_STYLES = [
  { icon: "language", box: "bg-[#e2f3ee]", ink: "text-[#2eaf9d]" },
  { icon: "leaf", box: "bg-[#e4f1ee]", ink: "text-[#42bca9]" },
  { icon: "idea", box: "bg-[#e8f5ef]", ink: "text-[#4cc3ae]" },
  { icon: "characters", box: "bg-[#e5f1f6]", ink: "text-[#4a9fc8]" },
  { icon: "book", box: "bg-[#eeeafb]", ink: "text-[#8d87dc]" },
] as const;

type Category = (typeof CATEGORIES)[number];
type Sort = (typeof SORTS)[number]["value"];

function withLibraryParams({
  q,
  category,
  sort,
  overrides = {},
}: {
  q: string;
  category: Category;
  sort: Sort;
  overrides?: Partial<{ q: string; category: Category; sort: Sort; batch: number }>;
}) {
  const params = new URLSearchParams();
  const nextQ = overrides.q ?? q;
  const nextCategory = overrides.category ?? category;
  const nextSort = overrides.sort ?? sort;
  if (nextQ.trim()) params.set("q", nextQ.trim());
  if (nextCategory !== "全部") params.set("category", nextCategory);
  if (nextSort !== "popular") params.set("sort", nextSort);
  if (overrides.batch) params.set("batch", String(overrides.batch));
  const query = params.toString();
  return query ? `/library?${query}` : "/library";
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; sort?: string; batch?: string }>;
}) {
  const uid = await getUserId();
  if (!uid) redirect("/login");
  const { q = "", category: rawCategory = "全部", sort: rawSort = "popular", batch: rawBatch = "0" } = await searchParams;
  const category: Category = CATEGORIES.includes(rawCategory as Category) ? (rawCategory as Category) : "全部";
  const sort: Sort = SORTS.some((item) => item.value === rawSort) ? (rawSort as Sort) : "popular";
  const supabase = await createClient();
  const orderColumn = sort === "recent" ? "created_at" : "learner_count";
  let query = supabase.from("books").select("*").order(orderColumn, { ascending: false }).order("id");
  if (category !== "全部") query = query.eq("category", category);
  if (q.trim()) query = query.ilike("title", `%${q.trim()}%`);
  const { data: books, error } = await query;
  if (error) throw new Error("无法读取社区卡册");
  const batches = Math.max(1, Math.ceil((books?.length ?? 0) / 3));
  const batch = Math.min(batches - 1, Math.max(0, Number.parseInt(rawBatch, 10) || 0));
  const visibleBooks = (books ?? []).slice(batch * 3, batch * 3 + 3);

  return (
    <div className="app-page flex flex-1 flex-col px-4 pt-7 pb-28 min-[400px]:px-5">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="app-page-title">社区</h1>
          <p className="mt-1 text-[0.8125rem] leading-5 text-muted-foreground">按学科与目标，发现适合你的卡册</p>
        </div>
        <LibrarySearchButton />
      </header>

      <form id="library-search" className="relative mt-5" action="/library" method="get">
        {category !== "全部" ? <input type="hidden" name="category" value={category} /> : null}
        {sort !== "popular" ? <input type="hidden" name="sort" value={sort} /> : null}
        <Search className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground/70" />
        <Input
          id="library-query"
          name="q"
          defaultValue={q}
          placeholder="搜索卡册、学科、考试"
          aria-label="搜索卡册"
          className="h-12 rounded-2xl border-primary/15 bg-white/75 pl-11 pr-4 text-[15px] shadow-sm placeholder:text-muted-foreground/75 focus-visible:border-primary/40 focus-visible:ring-primary/20"
        />
      </form>

      <nav aria-label="社区分类" className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {CATEGORIES.map((item) => (
          <Link
            key={item}
            href={withLibraryParams({ q, category, sort, overrides: { category: item } })}
            aria-current={category === item ? "page" : undefined}
            className={`flex h-9 shrink-0 items-center rounded-full px-3 text-[0.8125rem] transition-colors ${
              category === item
                ? "bg-primary text-primary-foreground shadow-[0_6px_14px_rgba(42,168,154,0.2)]"
                : "bg-primary/8 text-muted-foreground hover:bg-primary/12"
            }`}
          >
            {item}
          </Link>
        ))}
      </nav>

      <section aria-labelledby="featured-books-title" className="mt-5 grid grid-cols-[minmax(0,1fr)_clamp(108px,35vw,160px)] items-center gap-1 rounded-[28px] bg-[#E5F3EC] px-4 py-5 shadow-[0_10px_28px_rgba(49,128,113,0.08)] sm:px-5">
        <div className="min-w-0">
          <h2 id="featured-books-title" className="text-[clamp(1.25rem,5.6vw,1.5rem)] font-semibold leading-snug tracking-[-0.03em] text-[#163b36]">精选卡册</h2>
          <p className="mt-1 text-[0.8125rem] leading-5 text-[#5a8279]">精选内容，随时学习</p>
          <Link
            href="#library-books"
            className="mt-4 inline-flex min-h-9 items-center gap-1 rounded-full bg-primary px-3.5 py-1.5 text-[0.8125rem] font-medium text-primary-foreground shadow-[0_8px_18px_rgba(42,168,154,0.22)] transition-transform hover:brightness-105 active:scale-95"
          >
            开始发现
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
        <FeaturedCardsArt />
      </section>

      <section id="library-books" className="mt-5 scroll-mt-5">
        <div className="flex items-center justify-between gap-3">
          <nav aria-label="卡册排序视图" className="flex items-center gap-5">
            {SORTS.map((item) => (
              <Link
                key={item.value}
                href={withLibraryParams({ q, category, sort, overrides: { sort: item.value } })}
                aria-current={sort === item.value ? "page" : undefined}
                className={`relative pb-2 text-sm transition-colors ${sort === item.value ? "font-semibold text-foreground" : "text-muted-foreground"}`}
              >
                {item.value === "popular" ? "热门" : "最新"}
                {sort === item.value ? <span className="absolute inset-x-0 bottom-0 mx-auto h-0.5 w-7 rounded-full bg-primary" /> : null}
              </Link>
            ))}
          </nav>
          <LibrarySort sort={sort} q={q} category={category} />
        </div>
      </section>

      {(books ?? []).length > 0 ? (
        <ul className="mt-3 space-y-3 pb-8">
          {visibleBooks.map((book, index) => {
            const style = BOOK_STYLES[index % BOOK_STYLES.length];
            return (
              <li key={book.id}>
                <Link
                  href={`/library/${book.id}`}
                  className="app-card app-card-interactive group grid grid-cols-[2.75rem_minmax(0,1fr)_1rem] items-center gap-x-3 gap-y-2 rounded-[24px] p-3.5 active:scale-[0.99]"
                >
                  <div className={`flex size-11 items-center justify-center rounded-2xl ${style.box} ${style.ink}`}>
                    <AppIcon name={style.icon} className="size-6" />
                  </div>
                  <p className="min-w-0 text-sm font-semibold leading-[1.5] [overflow-wrap:anywhere]">{book.title}</p>
                  <ChevronRight className="size-4 self-start text-muted-foreground/70 transition-colors group-hover:text-primary" />
                  <p className="col-span-3 text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">
                    {book.description ?? "把重点内容整理成清晰卡片，随时打开复习。"}
                  </p>
                  <div className="col-span-3 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[0.6875rem] leading-4 text-muted-foreground">
                    <span className="max-w-full [overflow-wrap:anywhere]">{book.author ?? "V-记社区"}</span>
                    {book.learner_count >= 1 ? <span className="inline-flex items-center gap-2 whitespace-nowrap">
                      <span aria-hidden="true" className="size-1 rounded-full bg-muted-foreground/45" />
                      {book.learner_count.toLocaleString("zh-CN")} 人在学
                    </span> : null}
                    <span className="ml-auto shrink-0 rounded-full bg-primary/10 px-2 py-1 font-medium text-primary">{book.is_free ? "免费" : "精选"}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-4">
          <EmptyState title="还没有找到卡册" description="换个关键词或分类试试。" actionHref="/library" actionLabel="查看全部" />
        </div>
      )}

      {batches > 1 ? (
        <div className="mb-4 flex items-center justify-center gap-3">
          <span className="text-xs text-muted-foreground" aria-live="polite">第 {batch + 1} / {batches} 批</span>
          <Link href={`${withLibraryParams({ q, category, sort, overrides: { batch: (batch + 1) % batches } })}#library-books`} className="inline-flex h-10 items-center gap-2 rounded-full bg-white/70 px-4 text-xs text-muted-foreground shadow-sm">
            <RefreshCw className="size-3.5" />换一批
          </Link>
        </div>
      ) : null}
    </div>
  );
}
