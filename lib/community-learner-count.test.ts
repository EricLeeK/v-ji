import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({ count: 0 }));
vi.mock("@/lib/supabase/server", () => ({
  getUserId: async () => "signed-in-user",
  createClient: async () => ({
    from(table: string) {
      const book = { id: "book-1", title: "真实卡册", author: "作者", category: "英语", description: "内容", is_free: true, toc: [], learner_count: fixture.count };
      return {
        select() { return this; }, order() { return this; }, eq() { return this; }, ilike() { return this; },
        maybeSingle: async () => ({ data: table === "books" ? book : null, error: null }),
        then(resolve: (value: unknown) => unknown) { return Promise.resolve({ data: table === "books" ? [book] : [], error: null }).then(resolve); },
      };
    },
  }),
}));
vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => React.createElement("a", { href }, children) }));
vi.mock("@/components/library/library-sort", () => ({ LibrarySearchButton: () => null, LibrarySort: () => null }));
vi.mock("@/components/library/join-book-button", () => ({ JoinBookButton: () => null }));

import LibraryPage from "@/app/(app)/library/page";
import BookDetailPage from "@/app/(app)/library/[bookId]/page";

describe("real community learner counts", () => {
  for (const count of [0, 1, 1200]) {
    it(`list and detail ${count === 0 ? "hide zero" : `show exactly ${count} learners`}`, async () => {
      fixture.count = count;
      for (const content of [
        await LibraryPage({ searchParams: Promise.resolve({}) }),
        await BookDetailPage({ params: Promise.resolve({ bookId: "book-1" }) }),
      ]) {
        const text = renderToStaticMarkup(content).replace(/<[^>]*>/g, "");
        if (count === 0) expect(text).not.toContain("人在学");
        else expect(text).toContain(`${count.toLocaleString("zh-CN")} 人在学`);
      }
    });
  }
});
