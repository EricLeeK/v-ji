"use client";

import { AppIcon } from "@/components/app-icon";
import { useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useMutation } from "@tanstack/react-query";
import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { ArrowLeft, ArrowRightLeft, Hand, MoreHorizontal, Star, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { submitReview, exitStudy } from "@/app/actions/study";
import { CardFace, spokenText } from "@/components/cards/card-face";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { UserSettings } from "@/lib/settings";
import {
  Rating,
  RATING_LABELS,
  gestureToRating,
  type Grade,
} from "@/lib/srs/scheduler";
import type { QueueCard } from "@/lib/srs/queue";
import { useStudyStore } from "@/lib/stores/study-store";
import { useSpeech } from "@/lib/hooks/use-speech";
import { resolveSwipeGesture, swipeExitX, type SwipeExit } from "@/lib/study-transition";
import {
  studyDoneTitle,
  studyProgress,
  studySessionPhase,
  type StudyScope,
} from "@/lib/study-progress";
import { cn } from "@/lib/utils";
import { localDateKey } from "@/lib/dates";

export function StudySession({
  initialQueue,
  settings,
  scope = "today",
}: {
  initialQueue: QueueCard[];
  settings: UserSettings;
  scope?: StudyScope;
}) {
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [picked, setPicked] = useState<{ cardId: string; key: string }>();
  const [exiting, setExiting] = useState(false);
  const [outgoing, setOutgoing] = useState<QueueCard | null>(null);
  const booted = useRef(false);
  const queue = useStudyStore((s) => (booted.current ? s.queue : initialQueue));
  const face = useStudyStore((s) => (booted.current ? s.face : initialQueue.length ? "front" : "done"));
  const reviews = useStudyStore((s) => (booted.current ? s.reviews : 0));
  const total = useStudyStore((s) => (booted.current ? s.total : initialQueue.length));
  const startedAt = useStudyStore((s) => (booted.current ? s.startedAt : 0));
  const finishedAt = useStudyStore((s) => (booted.current ? s.finishedAt : 0));
  const showAnswer = useStudyStore((s) => s.showAnswer);
  const rateInStore = useStudyStore((s) => s.rate);
  const storedSettings = useStudyStore((s) => (booted.current ? s.settings : settings));
  const current = queue[0];
  const display = outgoing ?? current;
  const progress = studyProgress(total, queue.length);
  const { speak } = useSpeech(storedSettings.tts);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-10, 10]);
  const leftHint = useTransform(x, [-140, 0], [1, 0]);
  const rightHint = useTransform(x, [0, 140], [0, 1]);
  const exitLock = useRef(false);

  useLayoutEffect(() => {
    booted.current = true;
    useStudyStore.getState().hydrate(initialQueue, settings);
    x.jump(0);
    // Mount-only: keyed by scope in the page so leftover sessions remount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mutation = useMutation({
    mutationFn: async (payload: Parameters<typeof submitReview>[0]) => {
      const result = await submitReview(payload);
      if (result.error) throw new Error(result.error);
      return result;
    },
  });

  async function commitRate(rating: Grade, exit?: SwipeExit) {
    if (exitLock.current || exiting || !current) return;
    exitLock.current = true;
    setOutgoing(current);
    setExiting(true);
    try {
      if (exit) {
        await animate(x, swipeExitX(exit), { duration: 0.18, ease: "easeOut" });
      }
      const payload = rateInStore(rating);
      x.jump(0);
      flushSync(() => setOutgoing(null));
      if (payload) {
        try {
          await mutation.mutateAsync({ ...payload, clientDate: localDateKey() });
        } catch (error) {
          useStudyStore.getState().restore(payload);
          toast.error(error instanceof Error ? error.message : "保存复习结果失败，请重试");
        }
      }
    } finally {
      exitLock.current = false;
      setExiting(false);
    }
  }

  if (face === "done" || !current) {
    const empty = studySessionPhase(total, queue.length) === "empty";
    const minutes = Math.max(1, Math.round((finishedAt - startedAt) / 60000));
    return (
      <div
        data-testid="study-session"
        className="study-session flex h-dvh min-h-0 flex-1 flex-col overflow-hidden overscroll-none bg-[linear-gradient(180deg,#d8efe8_0%,#f7faf8_42%)]"
      >
        <div className="mx-auto flex min-h-0 w-full max-w-[430px] flex-1 flex-col px-6 py-10">
          <div className="flex-1 pt-16 text-center">
            <div className="mx-auto mb-6 flex size-24 items-center justify-center rounded-full bg-primary/15 text-5xl">
              <AppIcon name="complete" className="size-12 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold">
              {empty ? "暂时没有待学卡片" : studyDoneTitle(scope)}
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {empty
                ? "去卡片盒里加练，或明天再来。新卡会按每日上限进入今日任务。"
                : `本轮复习 ${reviews} 张，大约用了 ${minutes} 分钟。去看看学习统计，或继续加练一个卡片盒。`}
            </p>
          </div>
          <div className="space-y-3 pb-8">
            <Button className="h-12 w-full rounded-full" onClick={() => void exitStudy("/today")}>
              返回今日
            </Button>
            <Button variant="outline" className="h-12 w-full rounded-full" onClick={() => void exitStudy("/decks")}>
              去卡片盒
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!display) return null;

  return (
    <div
      data-testid="study-session"
      className="study-session flex h-dvh min-h-0 flex-1 flex-col overflow-hidden overscroll-none bg-[linear-gradient(180deg,#cfe8e1_0%,#f6f8f7_38%)]"
    >
      <div className="mx-auto flex min-h-0 w-full max-w-[430px] flex-1 flex-col">
        <header className="flex items-center justify-between px-4 py-3">
          <button
            type="button"
            aria-label="结束学习"
            onClick={() => setLeaveOpen(true)}
            className="flex size-10 items-center justify-center rounded-full bg-white/80 shadow-sm"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="min-w-0 flex-1 px-4">
            <div className="truncate text-center text-base font-semibold">学习中</div>
          </div>
          <div className="flex items-center gap-2"><button type="button" aria-label="朗读" onClick={() => speak(spokenText(display.note.type, display.note.fields, face === "back"))} className="flex size-10 items-center justify-center rounded-full bg-white/80 shadow-sm"><Volume2 className="size-4" /></button><button type="button" aria-label="切换卡片" className="flex size-10 items-center justify-center rounded-full bg-white/80 shadow-sm"><ArrowRightLeft className="size-4" /></button><button type="button" aria-label="更多学习选项" className="flex size-10 items-center justify-center rounded-full bg-white/80 shadow-sm"><MoreHorizontal className="size-5" /></button></div>
        </header>

        <div className="px-5 pt-3">
          <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground"><span>进度 {progress.cleared} / {progress.total}</span><span>本组剩余 {progress.remaining} 张</span></div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/70">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center overflow-hidden px-5 py-6">
          <motion.div
            aria-hidden
            style={{ opacity: leftHint }}
            className="pointer-events-none absolute top-8 left-8 z-10 rounded-full bg-rose-500 px-3 py-1 text-xs font-semibold text-white"
          >
            {RATING_LABELS[gestureToRating(storedSettings.gesture.left)].label}
          </motion.div>
          <motion.div
            aria-hidden
            style={{ opacity: rightHint }}
            className="pointer-events-none absolute top-8 right-8 z-10 rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-white"
          >
            {RATING_LABELS[gestureToRating(storedSettings.gesture.right)].label}
          </motion.div>
          <motion.div
            drag={face === "back" && !exiting ? "x" : false}
            dragListener={!exiting}
            dragMomentum={false}
            dragElastic={0.35}
            style={{ x, rotate }}
            onDragEnd={(_, info) => {
              const swipe = resolveSwipeGesture(info.offset.x);
              if (!swipe) {
                void animate(x, 0, { type: "spring", stiffness: 420, damping: 32 });
                return;
              }
              void commitRate(
                gestureToRating(
                  swipe === "left" ? storedSettings.gesture.left : storedSettings.gesture.right,
                ),
                swipe,
              );
            }}
            onClick={() => {
              if (exiting || face === "back") return;
              if (display.note.type === "choice") return;
              showAnswer();
            }}
            className="touch-pan-y relative flex max-h-full min-h-[280px] w-full cursor-pointer flex-col overflow-hidden rounded-[30px] bg-white p-6 text-left shadow-[0_18px_50px_rgba(30,70,60,0.12)] will-change-transform"
          >
            <motion.div aria-hidden style={{ opacity: leftHint }} className="pointer-events-none absolute inset-0 rounded-[28px] border-4 border-rose-400" />
            <motion.div aria-hidden style={{ opacity: rightHint }} className="pointer-events-none absolute inset-0 rounded-[28px] border-4 border-emerald-400" />
            <div className="mb-4 flex items-center justify-between"><span className="rounded-xl bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">正面</span><button type="button" aria-label="收藏卡片" onClick={(event) => event.stopPropagation()} className="flex size-9 items-center justify-center rounded-full text-muted-foreground"><Star className="size-6" /></button></div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <CardFace
                type={display.note.type}
                fields={display.note.fields}
                ord={display.ord}
                revealed={outgoing ? true : face === "back"}
                layout={display.note.layout}
                source={display.note.source}
                selectedKey={picked?.cardId === display.id ? picked.key : undefined}
                onSelectOption={
                  display.note.type === "choice" && face === "front" && !exiting
                    ? (key) => {
                        setPicked({ cardId: display.id, key });
                        showAnswer();
                      }
                    : undefined
                }
              />
            </div>
          </motion.div>
        </div>

        <div className="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {face === "front" ? (
              <button
                type="button"
                aria-label={display.note.type === "choice" ? "直接看答案" : "显示答案"}
                className="flex h-12 w-full items-center justify-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                disabled={exiting}
                onClick={() => showAnswer()}
              >
                <span>{display.note.type === "choice" ? "直接看答案" : "轻点卡片查看背面"}</span><Hand className="size-5" />
              </button>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {([Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as Grade[]).map((rating) => {
                const meta = RATING_LABELS[rating];
                return (
                  <button
                    key={rating}
                    type="button"
                    disabled={exiting}
                    onClick={() => void commitRate(rating)}
                    className={cn(
                      "flex h-[72px] min-w-0 flex-col items-center justify-center rounded-2xl px-1 text-white active:scale-[0.97] disabled:opacity-60",
                      meta.color,
                    )}
                  >
                    <span className="text-sm font-semibold">{meta.label}</span>
                    <span className="mt-0.5 text-center text-[10px] leading-tight text-white/80">
                      {meta.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>结束本轮学习？</AlertDialogTitle>
          </AlertDialogHeader>
          <p className="text-sm text-muted-foreground">未完成的卡片会留在今日任务里。</p>
          <AlertDialogFooter>
            <AlertDialogCancel>继续学</AlertDialogCancel>
            <AlertDialogAction onClick={() => void exitStudy("/today")}>结束</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
