import { describe, expect, it, vi } from 'vitest';
import { createReviewQueue } from './study-review-queue';

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe('background review saves', () => {
  it('accepts the next review immediately but persists reviews in order', async () => {
    const first = deferred();
    const send = vi.fn().mockImplementationOnce(() => first.promise).mockResolvedValue(undefined);
    const queue = createReviewQueue<number>({ send, onError: vi.fn(), onPending: vi.fn() });
    queue.enqueue(1);
    queue.enqueue(2);
    expect(queue.pending).toBe(2);
    expect(send.mock.calls).toEqual([[1]]);
    const completed = vi.fn();
    const flushed = queue.flush().then(completed);
    await Promise.resolve();
    expect(completed).not.toHaveBeenCalled();
    first.resolve();
    await flushed;
    expect(send.mock.calls).toEqual([[1], [2]]);
    expect(completed).toHaveBeenCalledWith(true);
    expect(queue.pending).toBe(0);
  });

  it('stops unsent dependent reviews after a failure and rolls back from the first failure', async () => {
    const first = deferred();
    const onError = vi.fn();
    const send = vi.fn().mockImplementationOnce(() => first.promise).mockResolvedValue(undefined);
    const queue = createReviewQueue<number>({ send, onError, onPending: vi.fn() });
    queue.enqueue(1);
    queue.enqueue(2);
    const flushed = queue.flush();
    const error = new Error('offline');
    first.reject(error);
    expect(await flushed).toBe(false);
    expect(send).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(error, 1);
    expect(queue.pending).toBe(0);
    expect(await queue.flush()).toBe(false);
    queue.enqueue(3);
    expect(await queue.flush()).toBe(true);
  });
});

it('keeps completed saves when a later save fails', async () => {
  const second = deferred();
  const send = vi.fn().mockResolvedValueOnce(undefined).mockImplementationOnce(() => second.promise);
  const onError = vi.fn();
  const queue = createReviewQueue<number>({ send, onError, onPending: vi.fn() });
  queue.enqueue(1);
  queue.enqueue(2);
  queue.enqueue(3);
  await Promise.resolve();
  expect(send.mock.calls).toEqual([[1], [2]]);
  const flushed = queue.flush();
  const error = new Error('conflict');
  second.reject(error);
  expect(await flushed).toBe(false);
  expect(onError).toHaveBeenCalledWith(error, 2);
  expect(send).toHaveBeenCalledTimes(2);
});
