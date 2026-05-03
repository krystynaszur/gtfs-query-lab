import { useState } from 'react';
import { SCENARIOS } from '../lib/scenarios';
import { ScenarioPanel } from './ScenarioPanel';

const ICONS = ['①', '②', '③', '④'];

export function ScenarioLab() {
  const [activeId, setActiveId] = useState(SCENARIOS[0].id);
  const active = SCENARIOS.find((s) => s.id === activeId)!;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row gap-2">
        {SCENARIOS.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setActiveId(s.id)}
            className={[
              'flex-1 text-left px-4 py-3 rounded-2xl border text-sm transition-colors',
              activeId === s.id
                ? 'border-[var(--color-transit-green-accent)] bg-[var(--color-transit-green-bg)] text-[var(--color-transit-green)]'
                : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-transit-green-accent)] hover:text-[var(--color-text-primary)]',
            ].join(' ')}
          >
            <span className="block text-base font-semibold mb-1">{ICONS[i]}</span>
            <span className="font-medium leading-snug">{s.title}</span>
          </button>
        ))}
      </div>

      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-6 shadow-sm">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-4">{active.title}</h2>
        <ScenarioPanel key={active.id} scenario={active} />
      </div>
    </div>
  );
}
