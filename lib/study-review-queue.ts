/** Serialize writes without making the next card wait for a network round trip. */
export function createReviewQueue<T>({
  send,
  onError,
  onPending,
}: {
  send: (payload: T) => Promise<unknown>;
  onError: (error: unknown, failed: T) => void;
  onPending: (count: number) => void;
}) {
  const items: T[] = [];
  let running = false;
  let failed = false;
  let waiters: Array<(saved: boolean) => void> = [];

  async function drain() {
    if (running) return;
    running = true;
    try {
      while (items.length) {
        const current = items[0];
        try {
          await send(current);
        } catch (error) {
          // Later ratings may depend on this card's optimistic FSRS state.
          // Restore its checkpoint and never send the dependent writes.
          failed = true;
          items.length = 0;
          onError(error, current);
          break;
        }
        items.shift();
        onPending(items.length);
      }
    } finally {
      running = false;
      onPending(items.length);
      const finished = waiters;
      waiters = [];
      finished.forEach((resolve) => resolve(!failed));
    }
  }

  return {
    get pending() { return items.length; },
    enqueue(payload: T) {
      failed = false;
      items.push(payload);
      onPending(items.length);
      void drain();
    },
    flush(): Promise<boolean> {
      if (!running) return Promise.resolve(!failed);
      return new Promise((resolve) => waiters.push(resolve));
    },
  };
}
