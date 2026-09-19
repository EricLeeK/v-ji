"use client";

import { useFormStatus } from "react-dom";
import { signOut } from "@/app/actions/auth";

export function SignOutButton() {
  return (
    <form action={signOut}>
      <Submit />
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="w-full rounded-2xl border border-destructive/10 bg-destructive/[0.04] py-3 text-sm text-destructive transition-colors hover:bg-destructive/[0.08] disabled:opacity-60">
      {pending ? "退出中..." : "退出登录"}
    </button>
  );
}
