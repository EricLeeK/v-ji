"use client";

export function speak(text: string, options?: { lang?: string; rate?: number; voice?: string }, events?: { onEnd: () => void; onError: (error: string) => void }) {
  if (typeof window === "undefined" || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return false;
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
  utterance.onend = () => events?.onEnd();
  utterance.onerror = event => {
    if (event.error === "interrupted" || event.error === "canceled") events?.onEnd();
    else events?.onError("朗读未能启动，请检查设备音量或在设置中更换音色");
  };
  window.speechSynthesis.speak(utterance);
  return true;
}

export function listVoices() {
  if (typeof window === "undefined" || !window.speechSynthesis) return [];
  return window.speechSynthesis.getVoices();
}
