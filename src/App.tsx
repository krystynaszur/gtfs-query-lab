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
    <div className="min-h-screen" style={{ background: 'linear-gradient(0deg, rgb(255, 250, 248) 95%, rgb(249, 237, 237) 96.0808%)' }}>
      <header className="bg-[var(--color-transit-green)] border-b border-[var(--color-transit-green-mid)] shadow-md">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-amber)] flex items-center justify-center flex-shrink-0">
              <span className="text-[var(--color-transit-green)] text-base font-bold">G</span>
            </div>
            <div>
              <h1
                className="text-xl font-bold text-white tracking-tight leading-tight"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                GTFS Query Lab
              </h1>
              <p className="text-sm text-[var(--color-transit-green-text)] mt-0.5">
                Explore &amp; optimize SQL queries on real transit data
              </p>
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
              className="text-sm text-[#B8D4C4] hover:text-white transition-colors font-medium"
            >
              Load different feed
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {!db ? (
          <>
            <div className="mb-6 rounded-xl bg-[#FFFBF0] border border-[#FFE299] px-6 py-5">
              <p
                className="text-base font-semibold mb-4 text-[var(--color-transit-green)]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                What you can do with GTFS Query Lab
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {([
                  {
                    iconColor: '#92620A', bg: '#FFF7E0',
                    label: 'Free SQL editor',
                    desc: 'Write and run any query against GTFS tables',
                    icon: (
                      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                        <polyline points="6 8 2 11 6 14" />
                        <polyline points="14 8 18 11 14 14" />
                        <line x1="12" y1="5" x2="8" y2="17" />
                      </svg>
                    ),
                  },
                  {
                    iconColor: '#CC3300', bg: '#FFF0EB',
                    label: 'Execution plan viewer',
                    desc: 'Inspect and compare query plans side-by-side',
                    icon: (
                      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                        <line x1="4" y1="16" x2="4" y2="10" />
                        <line x1="10" y1="16" x2="10" y2="5" />
                        <line x1="16" y1="16" x2="16" y2="1" />
                        <line x1="1" y1="16" x2="19" y2="16" />
                      </svg>
                    ),
                  },
                  {
                    iconColor: '#12452B', bg: '#E6F4EC',
                    label: 'Scenario lab',
                    desc: 'Pre-built optimization challenges with hints',
                    icon: (
                      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                        <path d="M7 2v8L3 17h14l-4-7V2" />
                        <line x1="7" y1="2" x2="13" y2="2" />
                        <circle cx="12" cy="14" r="1" fill="currentColor" stroke="none" />
                      </svg>
                    ),
                  },
                ] as const).map(({ iconColor, bg, label, desc, icon }) => (
                  <div key={label} className="flex flex-col gap-3 bg-white rounded-lg px-4 py-4 border border-[#FFE8A0]">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: bg, color: iconColor }}>
                      {icon}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[var(--color-transit-green)]">{label}</p>
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <FeedLoader />
          </>
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
