"use client";

import { useCallback, useEffect, useState } from "react";
import { listVoices, speak } from "@/lib/tts";

export function useSpeech(options?: { lang?: string; rate?: number; voice?: string }) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const sync = () => setVoices(listVoices());
    sync();
    window.speechSynthesis.addEventListener("voiceschanged", sync);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", sync);
  }, []);

  const speakText = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      speak(text, options);
    },
    [options?.lang, options?.rate, options?.voice],
  );

  const cancel = useCallback(() => {
    if (typeof window === "undefined") return;
    window.speechSynthesis?.cancel();
  }, []);

  return { speak: speakText, cancel, voices };
}
