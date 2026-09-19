import { PhoneShell } from "@/components/phone-shell";
import { LoginForm } from "@/components/auth/login-form";
import { PRODUCT_MARK, PRODUCT_NAME } from "@/lib/brand";
import { Suspense } from "react";

export default function LoginPage() {
  return (
    <PhoneShell showTab={false}>
      <div className="flex flex-1 flex-col px-6 pt-16 pb-8">
        <div className="mb-10">
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary text-2xl text-primary-foreground">
            {PRODUCT_MARK}
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">{PRODUCT_NAME}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            间隔复习 · 记忆卡片 · 学习社区
            <br />
            每天记一点，长期记得住。
          </p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </PhoneShell>
  );
}
