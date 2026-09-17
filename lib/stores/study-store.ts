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
};

type StudyState = {
  queue: QueueCard[];
  face: StudyFace;
  /** Ratings submitted this session (includes Again). Used for the done screen. */
  reviews: number;
  /** Initial queue size for this session. Progress = (total - queue.length) / total. */
  total: number;
  startedAt: number;
  cardStartedAt: number;
  settings: UserSettings;
  hydrate: (queue: QueueCard[], settings: UserSettings) => void;
  showAnswer: () => void;
  rate: (rating: Grade) => ReviewPayload | null;
};

export const useStudyStore = create<StudyState>((set, get) => ({
  queue: [],
  face: "front",
  reviews: 0,
  total: 0,
  startedAt: 0,
  cardStartedAt: 0,
  settings: DEFAULT_SETTINGS,
  hydrate(queue, settings) {
    set({
      queue,
      settings,
      face: queue.length ? "front" : "done",
      reviews: 0,
      total: queue.length,
      startedAt: Date.now(),
      cardStartedAt: Date.now(),
    });
  },
  showAnswer() {
    if (get().face === "front") set({ face: "back" });
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
    });
    return payload;
  },
}));
