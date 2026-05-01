import type { DbHandle } from './gtfsLoader';

export interface Scenario {
  id: string;
  title: string;
  description: string;
  slow: { label: string; sql: string };
  fast: { label: string; sql: string };
  /** Optional setup to run before the fast query (e.g. CREATE INDEX) */
  setup?: (db: DbHandle) => Promise<void>;
  insight: string;
}
