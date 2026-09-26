import { PhoneShell } from "@/components/phone-shell";
import { LoginForm } from "@/components/auth/login-form";
import { PRODUCT_NAME } from "@/lib/brand";
import Image from "next/image";
import { Suspense } from "react";

export default function LoginPage() {
  return (
    <PhoneShell showTab={false}>
      <div className="flex flex-1 flex-col px-6 pt-16 pb-8">
        <div className="mb-10">
          <Image
            src="/icons/sprout-192.png"
            alt="V 记新芽"
            width={56}
            height={56}
            className="mb-4 rounded-2xl"
            priority
          />
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
