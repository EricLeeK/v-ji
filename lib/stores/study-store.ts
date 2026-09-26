"use client";

import { create } from "zustand";
import type { UserSettings } from "@/lib/settings";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import type { QueueCard } from "@/lib/srs/queue";
import {
  Rating,
  dbToFsrs,
  fsrsToPatch,
  scheduleReview,
  type FsrsCardPatch,
  type Grade,
} from "@/lib/srs/scheduler";

export type StudyFace = "front" | "back" | "done";

export type ReviewPayload = {
  cardId: string;
  rating: Grade;
  next: FsrsCardPatch;
  durationMs: number;
  isNew: boolean;
  expected: {
    due: string;
    state: number;
    reps: number;
  };
  previous: QueueCard;
  /** Local rollback only. Never serialize the queue into a server action. */
  checkpoint: { queue: QueueCard[]; reviews: number; sessionId: number };

};

type StudyState = {
  sessionId: number;
  queue: QueueCard[];
  face: StudyFace;
  /** Ratings submitted this session (includes Again). Used for the done screen. */
  reviews: number;
  /** Initial queue size for this session. Progress = (total - queue.length) / total. */
  total: number;
  startedAt: number;
  finishedAt: number;
  cardStartedAt: number;
  settings: UserSettings;
  hydrate: (queue: QueueCard[], settings: UserSettings) => void;
  showAnswer: () => void;
  postpone: () => boolean;
  removeCard: (cardId: string) => void;
  rate: (rating: Grade) => ReviewPayload | null;
  restore: (payload: ReviewPayload) => void;
};

export const useStudyStore = create<StudyState>((set, get) => ({
  sessionId: 0,
  queue: [],
  face: "front",
  reviews: 0,
  total: 0,
  startedAt: 0,
  finishedAt: 0,
  cardStartedAt: 0,
  settings: DEFAULT_SETTINGS,
  hydrate(queue, settings) {
    set({
      sessionId: get().sessionId + 1,
      queue,
      settings,
      face: queue.length ? "front" : "done",
      reviews: 0,
      total: queue.length,
      startedAt: Date.now(),
      finishedAt: 0,
      cardStartedAt: Date.now(),
    });
  },
  showAnswer() {
    if (get().face === "front") set({ face: "back" });
  },
  postpone() {
    const { queue } = get();
    if (queue.length < 2) return false;
    set({ queue: [...queue.slice(1), queue[0]], face: "front", cardStartedAt: Date.now() });
    return true;
  },
  removeCard(cardId) {
    const { queue, total } = get();
    const next = queue.filter(card => card.id !== cardId);
    set({ queue: next, total: total - (queue.length - next.length), face: next.length ? "front" : "done", cardStartedAt: Date.now(), finishedAt: next.length ? 0 : Date.now() });
  },
  rate(rating) {
    const { queue, face, cardStartedAt, settings } = get();
    const current = queue[0];
    if (!current || face !== "back") return null;
    const result = scheduleReview(
      dbToFsrs(current),
      rating,
      new Date(),
      settings.requestRetention,
    );
    const next = fsrsToPatch(result.card);
    const payload: ReviewPayload = {
      cardId: current.id,
      rating,
      next,
      durationMs: Date.now() - cardStartedAt,
      isNew: current.state === 0,
      expected: {
        due: current.due,
        state: current.state,
        reps: current.reps,
      },
      previous: current,
      checkpoint: { queue, reviews: get().reviews, sessionId: get().sessionId },
    };
    const updated = { ...current, ...next };
    const rest = queue.slice(1);
    // Again requeues the card — session total stays fixed, so progress does not jump ahead.
    const nextQueue = rating === Rating.Again ? [...rest, updated] : rest;
    set({
      queue: nextQueue,
      face: nextQueue.length ? "front" : "done",
      reviews: get().reviews + 1,
      cardStartedAt: Date.now(),
      finishedAt: nextQueue.length ? 0 : Date.now(),
    });
    return payload;
  },
  restore(payload) {
    if (get().sessionId !== payload.checkpoint.sessionId) return;
    set({
      queue: payload.checkpoint.queue,
      reviews: payload.checkpoint.reviews,
      face: "front",
      cardStartedAt: Date.now(),
      finishedAt: 0,
    });
  },
}));
