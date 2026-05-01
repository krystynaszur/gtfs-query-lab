import type { DbHandle } from './gtfsLoader';

export interface Scenario {
  id: string;
  title: string;
  description: string | ((tableSizes: Record<string, number>) => string);
  slow: { label: string; sql: string | ((tableSizes: Record<string, number>) => string) };
  fast: { label: string; sql: string | ((tableSizes: Record<string, number>) => string) };
  /** Runs before the slow query — use to reset state (e.g. DROP INDEX) */
  before?: (db: DbHandle) => Promise<void>;
  /** Runs between slow and fast queries — use to set up the optimisation (e.g. CREATE INDEX) */
  setup?: (db: DbHandle) => Promise<void>;
  insight: string | ((tableSizes: Record<string, number>) => string);
}
