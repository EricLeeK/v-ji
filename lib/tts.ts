"use client";

export function speak(text: string, options?: { lang?: string; rate?: number; voice?: string }) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = options?.lang || "zh-CN";
  utterance.rate = options?.rate ?? 1;
  if (options?.voice) {
    const voice = window.speechSynthesis
      .getVoices()
      .find((item) => item.name === options.voice);
    if (voice) utterance.voice = voice;
  }
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

export function listVoices() {
  if (typeof window === "undefined" || !window.speechSynthesis) return [];
  return window.speechSynthesis.getVoices();
}
