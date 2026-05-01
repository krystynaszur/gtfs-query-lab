import { useState } from 'react';
import { DBProvider, useDB } from './contexts/DBContext';
import { FeedLoader } from './components/FeedLoader';
import { FeedStats } from './components/FeedStats';
import { FreeQueryEditor } from './components/FreeQueryEditor';
import { ScenarioLab } from './components/ScenarioLab';

type Tab = 'free' | 'scenarios';

function TabNav({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: 'free', label: 'Free Query' },
    { id: 'scenarios', label: 'Scenario Lab' },
  ];
  return (
    <div className="flex gap-1 border-b border-[var(--color-border)]">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={[
            'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
            active === t.id
              ? 'border-[var(--color-brand)] text-[var(--color-brand-dark)]'
              : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]',
          ].join(' ')}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function AppShell() {
  const { db, loadFeed } = useDB();
  const [tab, setTab] = useState<Tab>('free');

  return (
    <div className="min-h-screen bg-[var(--color-subtle)]">
      <header className="bg-[var(--color-surface)] border-b border-[var(--color-border)] shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-[var(--color-brand)] flex items-center justify-center">
              <span className="text-white text-xs font-bold">G</span>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-[var(--color-text-primary)] tracking-tight">
                GTFS Query Lab
              </h1>
              <p className="text-xs text-[var(--color-text-muted)]">SQL optimization on real transit data</p>
            </div>
          </div>
          {db && (
            <button
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.zip';
                input.onchange = () => {
                  const file = input.files?.[0];
                  if (file) loadFeed(file);
                };
                input.click();
              }}
              className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-brand-dark)] transition-colors font-medium"
            >
              Load different feed
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {!db ? (
          <FeedLoader />
        ) : (
          <div className="flex flex-col gap-6">
            <FeedStats />
            <div className="flex flex-col gap-4">
              <TabNav active={tab} onChange={setTab} />
              {tab === 'free' ? <FreeQueryEditor /> : <ScenarioLab />}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <DBProvider>
      <AppShell />
    </DBProvider>
  );
}
