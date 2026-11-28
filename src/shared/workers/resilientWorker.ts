export const DEFAULT_WORKER_TIMEOUT_MS = 3000;

export class WorkerCancelledError extends Error {
  constructor(message = 'Worker request cancelled') {
    super(message);
    this.name = 'WorkerCancelledError';
  }
}

export function isWorkerCancelledError(err: unknown): boolean {
  return (
    err instanceof WorkerCancelledError ||
    (err instanceof Error && (err.name === 'WorkerCancelledError' || err.name === 'AbortError'))
  );
}

export interface WorkerRequestOptions {
  /** Optional AbortSignal to cancel this individual request. */
  signal?: AbortSignal;
  /** Optional key; submitting a new request with the same key cancels any older in-flight one. */
  supersedingKey?: string;
  /** Timeout threshold in ms before falling back to synchronous execution (default 3000ms). */
  timeoutMs?: number;
}

export interface BaseWorkerMessage {
  id: number;
}

export interface BaseWorkerResponse {
  id: number;
  type: string;
  result?: unknown;
  error?: string;
}

interface PendingEntry {
  id: number;
  workerGen: number;
  supersedingKey?: string;
  timeoutId: ReturnType<typeof setTimeout>;
  fallback: () => unknown;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  cleanupAbort?: () => void;
}

export interface ResilientWorkerClient<
  TReq extends BaseWorkerMessage,
> {
  call: <T>(
    buildReq: (id: number) => TReq,
    fallback: () => T,
    options?: WorkerRequestOptions,
  ) => Promise<T>;
  cancelPendingRequests: (options?: { terminateBusyWorker?: boolean }) => number;
  resetWorker: () => void;
  getPendingCount: () => number;
}

export function createResilientWorkerClient<
  TReq extends BaseWorkerMessage,
  TRes extends BaseWorkerResponse,
>(
  createWorker: () => Worker,
  defaultTimeoutMs = DEFAULT_WORKER_TIMEOUT_MS,
): ResilientWorkerClient<TReq> {
  let nextRequestId = 1;
  let workerInstance: Worker | null = null;
  let workerGeneration = 0;
  const pending = new Map<number, PendingEntry>();
  const supersedingMap = new Map<string, number>();

  const removeEntry = (id: number): PendingEntry | undefined => {
    const entry = pending.get(id);
    if (!entry) return undefined;
    pending.delete(id);
    clearTimeout(entry.timeoutId);
    entry.cleanupAbort?.();
    if (entry.supersedingKey && supersedingMap.get(entry.supersedingKey) === id) {
      supersedingMap.delete(entry.supersedingKey);
    }
    return entry;
  };

  const terminateCurrentWorker = () => {
    if (workerInstance) {
      try {
        workerInstance.terminate();
      } catch {
        // Ignore termination errors
      }
      workerInstance = null;
    }
    workerGeneration += 1;
  };

  const recoverFromFailure = (expectedGen: number, rebuildIfHadPending: boolean) => {
    if (expectedGen !== workerGeneration) return;

    const entries = [...pending.values()].filter((e) => e.workerGen === expectedGen);
    for (const entry of entries) {
      removeEntry(entry.id);
    }

    terminateCurrentWorker();

    if (rebuildIfHadPending && entries.length > 0) {
      ensureWorker();
    }

    for (const entry of entries) {
      try {
        entry.resolve(entry.fallback());
      } catch (err) {
        entry.reject(err);
      }
    }
  };

  const ensureWorker = (): Worker | null => {
    if (typeof Worker === 'undefined') return null;
    if (!workerInstance) {
      workerGeneration += 1;
      const gen = workerGeneration;
      let w: Worker;
      try {
        w = createWorker();
      } catch {
        return null;
      }

      w.onmessage = (event: MessageEvent<TRes>) => {
        if (gen !== workerGeneration) return;
        const msg = event.data;
        if (!msg || typeof msg.id !== 'number') return;
        const entry = pending.get(msg.id);
        if (!entry || entry.workerGen !== gen) return;
        removeEntry(msg.id);
        if (msg.type === 'ERROR') {
          entry.reject(new Error(msg.error ?? 'Worker execution failed'));
        } else {
          entry.resolve(msg.result);
        }
      };

      w.onerror = () => {
        recoverFromFailure(gen, true);
      };

      w.onmessageerror = () => {
        recoverFromFailure(gen, true);
      };

      workerInstance = w;
    }
    return workerInstance;
  };

  const cancelRequest = (id: number) => {
    const entry = removeEntry(id);
    if (!entry) return;
    entry.reject(new WorkerCancelledError());
  };

  const cancelPendingRequests = (options?: { terminateBusyWorker?: boolean }): number => {
    const entries = [...pending.values()];
    if (entries.length === 0) return 0;

    for (const entry of entries) {
      removeEntry(entry.id);
    }

    if (options?.terminateBusyWorker !== false) {
      terminateCurrentWorker();
    }

    for (const entry of entries) {
      entry.reject(new WorkerCancelledError());
    }
    return entries.length;
  };

  const resetWorker = () => {
    cancelPendingRequests({ terminateBusyWorker: true });
    terminateCurrentWorker();
  };

  const call = <T>(
    buildReq: (id: number) => TReq,
    fallback: () => T,
    options?: WorkerRequestOptions,
  ): Promise<T> => {
    if (options?.signal?.aborted) {
      return Promise.reject(new WorkerCancelledError());
    }

    if (options?.supersedingKey) {
      const prevId = supersedingMap.get(options.supersedingKey);
      if (prevId !== undefined) {
        cancelRequest(prevId);
      }
    }

    const worker = ensureWorker();
    if (!worker) {
      try {
        return Promise.resolve(fallback());
      } catch (err) {
        return Promise.reject(err);
      }
    }

    const id = nextRequestId++;
    const gen = workerGeneration;
    const timeoutMs = options?.timeoutMs ?? defaultTimeoutMs;

    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const entry = pending.get(id);
        if (!entry || entry.workerGen !== gen) return;
        recoverFromFailure(gen, true);
      }, timeoutMs);

      let cleanupAbort: (() => void) | undefined;
      if (options?.signal) {
        const onAbort = () => cancelRequest(id);
        options.signal.addEventListener('abort', onAbort, { once: true });
        cleanupAbort = () => options.signal?.removeEventListener('abort', onAbort);
      }

      if (options?.supersedingKey) {
        supersedingMap.set(options.supersedingKey, id);
      }

      pending.set(id, {
        id,
        workerGen: gen,
        supersedingKey: options?.supersedingKey,
        timeoutId,
        fallback,
        resolve: (val) => resolve(val as T),
        reject,
        cleanupAbort,
      });

      try {
        worker.postMessage(buildReq(id));
      } catch {
        recoverFromFailure(gen, true);
      }
    });
  };

  return {
    call,
    cancelPendingRequests,
    resetWorker,
    getPendingCount: () => pending.size,
  };
}
