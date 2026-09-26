"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { listVoices, speak } from "@/lib/tts";

export function useSpeech(options?: { lang?: string; rate?: number; voice?: string }) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(false);
  const request = useRef(0);
  const { lang, rate, voice } = options ?? {};

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const sync = () => { setVoices(listVoices()); setSupported(true); };
    sync();
    window.speechSynthesis.addEventListener("voiceschanged", sync);
    return () => {
      request.current += 1;
      window.speechSynthesis.removeEventListener("voiceschanged", sync);
      window.speechSynthesis.cancel();
    };
  }, []);

  const speakText = useCallback(
    (text: string) => {
      if (!text.trim()) { toast.info("这张卡片暂无可朗读的文字"); return; }
      const id = ++request.current;
      setSpeaking(true);
      try {
        const started = speak(text, { lang, rate, voice }, {
          onEnd: () => { if (request.current === id) setSpeaking(false); },
          onError: error => { if (request.current === id) { setSpeaking(false); toast.error(error); } },
        });
        if (!started) { setSpeaking(false); toast.error("当前浏览器不支持朗读，请使用支持系统语音的浏览器"); }
      } catch {
        setSpeaking(false);
        toast.error("朗读失败，请重试或在设置中更换音色");
      }
    },
    [lang, rate, voice],
  );

  const cancel = useCallback(() => {
    if (typeof window === "undefined") return;
    request.current += 1;
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);

  return { speak: speakText, cancel, voices, speaking, supported };
}
