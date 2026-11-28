import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createResilientWorkerClient,
  isWorkerCancelledError,
} from './resilientWorker';

interface MockReq {
  id: number;
  value: number;
}

interface MockRes {
  id: number;
  type: 'OK' | 'ERROR';
  result?: number;
  error?: string;
}

class MockWorker {
  onmessage: ((event: MessageEvent<MockRes>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent) => void) | null = null;
  posted: MockReq[] = [];
  terminated = false;

  postMessage(msg: MockReq) {
    this.posted.push(msg);
  }

  terminate() {
    this.terminated = true;
  }

  emitResult(id: number, result: number) {
    this.onmessage?.({ data: { id, type: 'OK', result } } as MessageEvent<MockRes>);
  }

  emitErrorEvent() {
    this.onerror?.(new ErrorEvent('error'));
  }
}

describe('ResilientWorkerClient', () => {
  let createdWorkers: MockWorker[] = [];
  const originalWorker = globalThis.Worker;

  beforeEach(() => {
    vi.useFakeTimers();
    createdWorkers = [];
    globalThis.Worker = class {
      constructor() {
        const w = new MockWorker();
        createdWorkers.push(w);
        return w as unknown as Worker;
      }
    } as unknown as typeof Worker;
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.Worker = originalWorker;
  });

  it('cancels in-flight requests, terminates busy worker, and ignores stale responses', async () => {
    const client = createResilientWorkerClient<MockReq, MockRes>(
      () => new (globalThis.Worker as unknown as new () => Worker)(),
    );

    const p1 = client.call(
      (id) => ({ id, value: 1 }),
      () => 101,
    );

    expect(createdWorkers).toHaveLength(1);
    const firstWorker = createdWorkers[0];
    expect(firstWorker.posted).toHaveLength(1);

    const cancelledCount = client.cancelPendingRequests();
    expect(cancelledCount).toBe(1);
    expect(firstWorker.terminated).toBe(true);
    expect(client.getPendingCount()).toBe(0);

    // Late message from old worker should be safely ignored
    firstWorker.emitResult(firstWorker.posted[0].id, 999);

    await expect(p1).rejects.toSatisfy((err) => isWorkerCancelledError(err));

    // Next request spawns a fresh worker cleanly
    const p2 = client.call(
      (id) => ({ id, value: 2 }),
      () => 202,
    );
    expect(createdWorkers).toHaveLength(2);
    const secondWorker = createdWorkers[1];
    secondWorker.emitResult(secondWorker.posted[0].id, 42);
    await expect(p2).resolves.toBe(42);
  });

  it('supersedes older in-flight requests with the same supersedingKey', async () => {
    const client = createResilientWorkerClient<MockReq, MockRes>(
      () => new (globalThis.Worker as unknown as new () => Worker)(),
    );

    const p1 = client.call(
      (id) => ({ id, value: 1 }),
      () => 1,
      { supersedingKey: 'coach' },
    );
    const p2 = client.call(
      (id) => ({ id, value: 2 }),
      () => 2,
      { supersedingKey: 'coach' },
    );

    const worker = createdWorkers[0];
    expect(worker.posted).toHaveLength(2);

    // Even if p1's response arrives first, it must be discarded
    worker.emitResult(worker.posted[0].id, 111);
    worker.emitResult(worker.posted[1].id, 222);

    await expect(p1).rejects.toSatisfy((err) => isWorkerCancelledError(err));
    await expect(p2).resolves.toBe(222);
  });

  it('falls back to synchronous computation and rebuilds worker on 3s timeout', async () => {
    const client = createResilientWorkerClient<MockReq, MockRes>(
      () => new (globalThis.Worker as unknown as new () => Worker)(),
      3000,
    );

    const fallback = vi.fn(() => 777);
    const p = client.call((id) => ({ id, value: 10 }), fallback);

    expect(createdWorkers).toHaveLength(1);
    const w1 = createdWorkers[0];

    await vi.advanceTimersByTimeAsync(3000);

    await expect(p).resolves.toBe(777);
    expect(fallback).toHaveBeenCalledTimes(1);
    expect(w1.terminated).toBe(true);
    // Rebuilt a fresh worker automatically
    expect(createdWorkers).toHaveLength(2);
  });

  it('falls back to synchronous computation and rebuilds worker on worker onerror', async () => {
    const client = createResilientWorkerClient<MockReq, MockRes>(
      () => new (globalThis.Worker as unknown as new () => Worker)(),
    );

    const fallback = vi.fn(() => 888);
    const p = client.call((id) => ({ id, value: 20 }), fallback);

    const w1 = createdWorkers[0];
    w1.emitErrorEvent();

    await expect(p).resolves.toBe(888);
    expect(fallback).toHaveBeenCalledTimes(1);
    expect(w1.terminated).toBe(true);
    expect(createdWorkers).toHaveLength(2);

    // Subsequent call works on the rebuilt worker
    const p2 = client.call(
      (id) => ({ id, value: 30 }),
      () => 999,
    );
    const w2 = createdWorkers[1];
    w2.emitResult(w2.posted[0].id, 300);
    await expect(p2).resolves.toBe(300);
  });
});
