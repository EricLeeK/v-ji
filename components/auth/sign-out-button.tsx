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
    <button type="submit" disabled={pending} className="w-full rounded-full py-3 text-sm text-destructive disabled:opacity-60">
      {pending ? "退出中..." : "退出登录"}
    </button>
  );
}
