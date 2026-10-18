'use client';

import { createStore, get, set, type UseStore } from 'idb-keyval';

/**
 * Swipes, undos and vetoes are written to the phone first and sent in batches when the
 * connection allows (R32), so swiping never waits on the network and nothing is lost if the
 * tab closes. Every swipe carries a client id, so retrying is always safe.
 */
export type QueuedOp =
  | {
      type: 'swipe';
      clientId: string;
      itemId: string;
      round: 'macro' | 'micro' | 'bridge';
      value: 1 | -1;
      decisionMs?: number;
      position?: number;
    }
  | { type: 'undo'; itemId: string }
  | { type: 'veto'; clientId: string; itemId: string; attribute?: string | null };

let store: UseStore | undefined;
function db(): UseStore {
  store ??= createStore('hearth', 'queue');
  return store;
}

const key = (participantId: string) => `ops:${participantId}`;

// Writes are serialised so two quick swipes never overwrite each other.
let chain: Promise<unknown> = Promise.resolve();
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(fn, fn);
  chain = next.catch(() => undefined);
  return next;
}

export function enqueue(participantId: string, op: QueuedOp): Promise<void> {
  return exclusive(async () => {
    const ops = (await get<QueuedOp[]>(key(participantId), db())) ?? [];
    await set(key(participantId), [...ops, op], db());
  });
}

export function pendingOps(participantId: string): Promise<QueuedOp[]> {
  return exclusive(async () => (await get<QueuedOp[]>(key(participantId), db())) ?? []);
}

const BATCH = 50;
let flushing: Promise<FlushResult> | null = null;

export interface FlushResult {
  /** Still waiting to be sent (offline, or the server said no). */
  pending: number;
  ok: boolean;
}

/** Sends everything queued. Safe to call often; concurrent calls share one request. */
export function flush(participantId: string): Promise<FlushResult> {
  flushing ??= doFlush(participantId).finally(() => {
    flushing = null;
  });
  return flushing;
}

async function doFlush(participantId: string): Promise<FlushResult> {
  for (;;) {
    const ops = await pendingOps(participantId);
    if (ops.length === 0) return { pending: 0, ok: true };
    const batch = ops.slice(0, BATCH);
    try {
      const res = await fetch('/api/swipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId, ops: batch }),
        keepalive: true,
      });
      if (!res.ok) {
        // 429 and 5xx will pass; 4xx means this session can't save them, so keep them safe.
        return { pending: ops.length, ok: false };
      }
    } catch {
      return { pending: ops.length, ok: false };
    }
    // Remove exactly what was sent; new swipes may have been added meanwhile.
    await exclusive(async () => {
      const current = (await get<QueuedOp[]>(key(participantId), db())) ?? [];
      await set(key(participantId), current.slice(batch.length), db());
    });
  }
}

export async function pendingCount(participantId: string): Promise<number> {
  return (await pendingOps(participantId)).length;
}
