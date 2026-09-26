"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";

/** A synchronous lock also catches double taps before React paints disabled state. */
export function useAction() {
  const lock = useRef(false);
  const [pending, setPending] = useState(false);
  async function run<T extends { error?: string }>(action: () => Promise<T>, onSuccess?: (result: T) => void | Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    try {
      const result = await action();
      if (result.error) { toast.error(result.error); return; }
      await onSuccess?.(result);
    } catch {
      toast.error("操作未完成，请检查网络后重试");
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  return { pending, run };
}
