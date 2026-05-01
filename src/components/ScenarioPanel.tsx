import type { Scenario } from '../lib/types';
import { QueryComparator } from './QueryComparator';
import { useDB } from '../contexts/DBContext';

interface ScenarioPanelProps {
  scenario: Scenario;
}

export function ScenarioPanel({ scenario }: ScenarioPanelProps) {
  const { tableSizes } = useDB();
  const description = typeof scenario.description === 'function'
    ? scenario.description(tableSizes)
    : scenario.description;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{description}</p>
      <QueryComparator
        slow={scenario.slow}
        fast={scenario.fast}
        before={scenario.before}
        setup={scenario.setup}
        insight={scenario.insight}
      />
    </div>
  );
}
