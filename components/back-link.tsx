import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export function BackLink({ href, label = "返回" }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      className="mb-3 inline-flex items-center gap-0.5 text-sm text-muted-foreground"
    >
      <ChevronLeft className="size-4" />
      {label}
    </Link>
  );
}
