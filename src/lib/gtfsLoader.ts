export type SqlRow = (string | number | null | Uint8Array)[];
export type SqlExecResult = { columns: string[]; values: SqlRow[] };

export type QueryResult = {
  results: SqlExecResult[];
  durationMs: number;
  error?: string;
};

export type DbHandle = {
  query: (sql: string) => Promise<QueryResult>;
  terminate: () => void;
};

export type LoadProgress = {
  stage: string;
  percent: number;
};

export async function loadGtfsFeed(
  source: File | ArrayBuffer,
  onProgress?: (p: LoadProgress) => void,
): Promise<DbHandle> {
  const worker = new Worker(
    new URL('../workers/db.worker.ts', import.meta.url),
    { type: 'module' },
  );

  let msgId = 0;
  const pending = new Map<number, { resolve: (v: QueryResult) => void; reject: (e: Error) => void }>();

  return new Promise((resolveLoad, rejectLoad) => {
    worker.onmessage = (e: MessageEvent) => {
      const { type, id, ...data } = e.data as Record<string, unknown> & { type: string; id: number };

      if (type === 'progress') {
        onProgress?.({ stage: data.stage as string, percent: data.percent as number });
      } else if (type === 'ready') {
        const handle: DbHandle = {
          query(sql: string): Promise<QueryResult> {
            const reqId = msgId++;
            return new Promise((res, rej) => {
              pending.set(reqId, { resolve: res, reject: rej });
              worker.postMessage({ type: 'query', id: reqId, sql });
            });
          },
          terminate() { worker.terminate(); },
        };
        resolveLoad(handle);
      } else if (type === 'result') {
        const p = pending.get(id);
        if (p) {
          pending.delete(id);
          p.resolve({
            results: data.results as SqlExecResult[],
            durationMs: data.durationMs as number,
            error: data.error as string | undefined,
          });
        }
      } else if (type === 'error') {
        rejectLoad(new Error(data.error as string));
      }
    };

    worker.onerror = (e) => rejectLoad(new Error(e.message));

    const bufferPromise =
      source instanceof File ? source.arrayBuffer() : Promise.resolve(source);

    bufferPromise.then((buf) => {
      worker.postMessage({ type: 'load', buffer: buf }, [buf]);
    });
  });
}
