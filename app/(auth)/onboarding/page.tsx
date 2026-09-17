"use client";

import { AppIcon } from "@/components/app-icon";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const SLIDES = [
  {
    icon: "memory",
    title: "间隔复习，对抗遗忘",
    body: "根据你的记忆反馈，在即将忘记时再把卡片推给你，用更短时间记住更多考点。",
  },
  {
    icon: "swipe",
    title: "滑一滑，记一记",
    body: "左滑忘记、右滑记得。也可以用四档按钮：忘记 / 困难 / 记得 / 简单。",
  },
  {
    icon: "library",
    title: "社区卡册随时加入",
    body: "考研、英语、古诗文等公开卡册一键加入自己的卡片盒，马上开始学。",
  },
  {
    icon: "chart",
    title: "看见自己的坚持",
    body: "学习时长、连续打卡和复习次数都会被记下来，让每天的努力看得见。",
  },
];

export default function OnboardingPage() {
  const [index, setIndex] = useState(0);
  const router = useRouter();
  const last = index === SLIDES.length - 1;
  const slide = SLIDES[index];

  return (
    <div className="min-h-dvh bg-[#d7e4df]">
      <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-background px-6 py-10">
        <div className="flex-1 pt-16 text-center">
          <div className="mx-auto mb-8 flex size-28 items-center justify-center rounded-[32px] bg-primary/10 text-primary"><AppIcon name={slide.icon} className="size-14" /></div>
          <h1 className="text-2xl font-semibold">{slide.title}</h1>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">{slide.body}</p>
        </div>
        <div className="flex justify-center gap-1.5 pb-6">
          {SLIDES.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full ${i === index ? "w-6 bg-primary" : "w-1.5 bg-muted"}`}
            />
          ))}
        </div>
        <div className="flex gap-3 pb-4">
          <Button variant="ghost" className="flex-1 rounded-full" onClick={() => router.push("/login")}>
            跳过
          </Button>
          <Button
            className="flex-1 rounded-full"
            onClick={() => (last ? router.push("/login") : setIndex((n) => n + 1))}
          >
            {last ? "开始使用" : "下一步"}
          </Button>
        </div>
      </div>
    </div>
  );
}
