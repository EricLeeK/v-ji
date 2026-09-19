import { ArrowRight, Bookmark, ChevronDown, RefreshCw, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppIcon } from "@/components/app-icon";
import { EmptyState } from "@/components/empty-state";
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
  overrides?: Partial<{ q: string; category: Category; sort: Sort }>;
}) {
  const params = new URLSearchParams();
  const nextQ = overrides.q ?? q;
  const nextCategory = overrides.category ?? category;
  const nextSort = overrides.sort ?? sort;
  if (nextQ.trim()) params.set("q", nextQ.trim());
  if (nextCategory !== "全部") params.set("category", nextCategory);
  if (nextSort !== "popular") params.set("sort", nextSort);
  const query = params.toString();
  return query ? `/library?${query}` : "/library";
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; sort?: string }>;
}) {
  const uid = await getUserId();
  if (!uid) redirect("/login");
  const { q = "", category: rawCategory = "全部", sort: rawSort = "popular" } = await searchParams;
  const category: Category = CATEGORIES.includes(rawCategory as Category) ? (rawCategory as Category) : "全部";
  const sort: Sort = SORTS.some((item) => item.value === rawSort) ? (rawSort as Sort) : "popular";
  const supabase = await createClient();
  const orderColumn = sort === "recent" ? "created_at" : "learner_count";
  let query = supabase.from("books").select("*").order(orderColumn, { ascending: false });
  if (category !== "全部") query = query.eq("category", category);
  if (q.trim()) query = query.ilike("title", `%${q.trim()}%`);
  const { data: books } = await query;

  return (
    <div className="app-page flex flex-1 flex-col px-5 pt-7 pb-28">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="app-page-title">社区</h1>
          <p className="mt-1 text-sm text-muted-foreground">发现别人整理好的高质量卡册</p>
        </div>
        <a
          href="#library-search"
          aria-label="搜索卡册"
          className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-white/80 bg-white/75 text-foreground/70 shadow-sm transition-colors hover:bg-white"
        >
          <Search className="size-5" />
        </a>
      </header>

      <form id="library-search" className="relative mt-5" action="/library" method="get">
        {category !== "全部" ? <input type="hidden" name="category" value={category} /> : null}
        {sort !== "popular" ? <input type="hidden" name="sort" value={sort} /> : null}
        <Search className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground/70" />
        <Input
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
            className={`flex h-9 shrink-0 items-center rounded-full px-4 text-sm transition-colors ${
              category === item
                ? "bg-primary text-primary-foreground shadow-[0_6px_14px_rgba(42,168,154,0.2)]"
                : "bg-primary/8 text-muted-foreground hover:bg-primary/12"
            }`}
          >
            {item}
          </Link>
        ))}
      </nav>

      <section className="relative mt-5 overflow-hidden rounded-[28px] border border-primary/10 bg-gradient-to-br from-[#e5f6f0] via-[#e8f6f1] to-[#d7eee7] px-5 py-5 shadow-[0_14px_34px_rgba(49,128,113,0.10)]">
        <div className="relative z-10 max-w-[57%]">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-primary/75">DAILY PICKS</p>
          <h2 className="mt-2 text-[26px] font-semibold tracking-[-0.06em] text-[#163b36]">精选卡册</h2>
          <p className="mt-1 text-sm text-[#5a8279]">优质内容，每日更新</p>
          <Link
            href={withLibraryParams({ q, category, sort })}
            className="mt-4 inline-flex h-9 items-center gap-1 rounded-full bg-primary px-3.5 text-sm font-medium text-primary-foreground shadow-[0_8px_18px_rgba(42,168,154,0.22)] transition-transform hover:brightness-105 active:scale-95"
          >
            开始发现
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute -right-1 top-0 h-full w-[48%]">
          <div className="absolute right-6 top-8 h-[92px] w-[112px] rotate-[14deg] rounded-[18px] border border-white/75 bg-[#f8fffc]/75 shadow-[0_10px_18px_rgba(57,132,116,0.12)]" />
          <div className="absolute right-10 top-5 h-[96px] w-[116px] rotate-[5deg] rounded-[18px] border border-white/80 bg-[#f8fffc]/90 shadow-[0_10px_18px_rgba(57,132,116,0.14)]">
            <div className="absolute left-4 top-4 flex size-8 items-center justify-center rounded-xl bg-[#d8f2e8] text-primary">
              <Sparkles className="size-4" />
            </div>
            <div className="absolute bottom-4 left-4 h-1.5 w-14 rounded-full bg-primary/20" />
          </div>
          <div className="absolute right-1 top-12 h-[98px] w-[118px] rotate-[-9deg] rounded-[18px] border border-white/80 bg-[#e8f8f1] shadow-[0_10px_18px_rgba(57,132,116,0.16)]" />
          <span className="absolute right-[116px] top-7 size-2.5 rounded-full bg-primary/70" />
          <span className="absolute right-[95px] top-[112px] size-1.5 rounded-full bg-[#f4c874]" />
        </div>
      </section>

      <section className="mt-5">
        <div className="flex items-center justify-between gap-3">
          <nav aria-label="卡册排序视图" className="flex items-center gap-5">
            {SORTS.map((item) => (
              <Link
                key={item.value}
                href={withLibraryParams({ q, category, sort, overrides: { sort: item.value } })}
                aria-current={sort === item.value ? "page" : undefined}
                className={`relative pb-2 text-[15px] transition-colors ${sort === item.value ? "font-semibold text-foreground" : "text-muted-foreground"}`}
              >
                {item.value === "popular" ? "热门" : "最新"}
                {sort === item.value ? <span className="absolute inset-x-0 bottom-0 mx-auto h-0.5 w-7 rounded-full bg-primary" /> : null}
              </Link>
            ))}
          </nav>
          <form action="/library" method="get" className="relative shrink-0">
            <input type="hidden" name="q" value={q} />
            {category !== "全部" ? <input type="hidden" name="category" value={category} /> : null}
            <select
              name="sort"
              defaultValue={sort}
              aria-label="卡册排序"
              className="h-9 w-[104px] appearance-none rounded-full border border-primary/10 bg-white/80 pl-3 pr-7 text-xs text-muted-foreground shadow-sm outline-none transition-colors focus:border-primary/30"
            >
              {SORTS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          </form>
        </div>
      </section>

      {(books ?? []).length > 0 ? (
        <ul className="mt-3 space-y-3 pb-8">
          {(books ?? []).map((book, index) => {
            const style = BOOK_STYLES[index % BOOK_STYLES.length];
            return (
              <li key={book.id}>
                <Link
                  href={`/library/${book.id}`}
                  className="app-card app-card-interactive group flex gap-3 rounded-[28px] p-4 active:scale-[0.99]"
                >
                  <div className={`flex size-[62px] shrink-0 items-center justify-center rounded-[21px] ${style.box} ${style.ink}`}>
                    <AppIcon name={style.icon} className="size-8" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-[15px] font-semibold tracking-[-0.02em]">{book.title}</p>
                      <Bookmark className="mt-0.5 size-[18px] shrink-0 text-muted-foreground/70 transition-colors group-hover:text-primary" />
                    </div>
                    <p className="mt-1 line-clamp-1 text-xs leading-5 text-muted-foreground">
                      {book.description ?? "把重点内容整理成清晰卡片，随时打开复习。"}
                    </p>
                    <div className="mt-2 flex min-w-0 items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="truncate">{book.author ?? "V-记社区"}</span>
                      <span aria-hidden="true" className="size-1 rounded-full bg-muted-foreground/45" />
                      <span className="shrink-0">{book.learner_count.toLocaleString()} 人在学</span>
                      <span className="ml-auto shrink-0 rounded-full bg-primary/10 px-2 py-1 font-medium text-primary">{book.is_free ? "免费" : "精选"}</span>
                    </div>
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

      {(books ?? []).length > 0 ? (
        <Link href={withLibraryParams({ q, category, sort: "popular" })} className="mx-auto mb-4 mt-1 inline-flex h-9 items-center gap-2 rounded-full bg-white/70 px-4 text-xs text-muted-foreground shadow-sm transition-colors hover:bg-white">
          <RefreshCw className="size-3.5" />
          换一批
        </Link>
      ) : null}
    </div>
  );
}
