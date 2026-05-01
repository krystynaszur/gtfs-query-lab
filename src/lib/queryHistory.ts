export interface HistoryEntry {
  id: number;
  sql: string;
  label?: string;
  durationMs: number;
  rowCount: number;
  isError: boolean;
  timestamp: number;
}

const MAX_ENTRIES = 50;
const subscribers = new Set<() => void>();
let entries: HistoryEntry[] = [];
let nextId = 0;

export function recordQuery(fields: Omit<HistoryEntry, 'id' | 'timestamp'>): void {
  entries = [{ ...fields, id: nextId++, timestamp: Date.now() }, ...entries].slice(0, MAX_ENTRIES);
  subscribers.forEach((fn) => fn());
}

export function getHistory(): readonly HistoryEntry[] {
  return entries;
}

export function clearHistory(): void {
  entries = [];
  subscribers.forEach((fn) => fn());
}

export function subscribeHistory(onChange: () => void): () => void {
  subscribers.add(onChange);
  return () => subscribers.delete(onChange);
}
