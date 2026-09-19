import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export function BackLink({ href, label = "返回" }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      className="mb-4 inline-flex min-h-8 items-center gap-0.5 self-start rounded-full pr-2 text-sm text-muted-foreground transition-colors hover:bg-primary/8 hover:text-foreground"
    >
      <ChevronLeft className="size-4" />
      {label}
    </Link>
  );
}
