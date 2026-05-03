import { useState, useRef } from 'react';
import { DBProvider, useDB } from './contexts/DBContext';
import { FeedLoader } from './components/FeedLoader';
import { FeedStats } from './components/FeedStats';
import { FreeQueryEditor } from './components/FreeQueryEditor';
import { ScenarioLab } from './components/ScenarioLab';
import { FeedValidator } from './components/FeedValidator';

type Tab = 'free' | 'scenarios' | 'validate';

function TabNav({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: 'free', label: 'Free Query' },
    { id: 'scenarios', label: 'Scenario Lab' },
    { id: 'validate', label: 'Feed Validator' },
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
  const fileInputRef = useRef<HTMLInputElement>(null);

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
                GTFS Workbench
              </h1>
              <p className="text-sm text-[var(--color-transit-green-text)] mt-0.5">
                Query, optimize, and validate GTFS feeds — all in your browser
              </p>
            </div>
          </div>
          {db && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                className="hidden"
                onChange={() => {
                  const file = fileInputRef.current?.files?.[0];
                  if (file) loadFeed(file);
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-sm text-[#B8D4C4] hover:text-white transition-colors font-medium"
              >
                Load different feed
              </button>
            </>
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
                What you can do with GTFS Workbench
              </p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {([
                  {
                    iconColor: '#92620A', bg: '#FFF7E0',
                    label: 'Free SQL editor',
                    desc: 'Ad-hoc SQL against any table in the loaded feed, with live execution plans',
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
                    desc: 'Compare slow and fast queries side-by-side with timing and plan analysis',
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
                    label: 'Scenario Lab',
                    desc: 'Four guided challenges teaching real-world query optimization on GTFS data',
                    icon: (
                      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                        <path d="M7 2v8L3 17h14l-4-7V2" />
                        <line x1="7" y1="2" x2="13" y2="2" />
                        <circle cx="12" cy="14" r="1" fill="currentColor" stroke="none" />
                      </svg>
                    ),
                  },
                  {
                    iconColor: '#1A5FA8', bg: '#EBF3FF',
                    label: 'Feed Validator',
                    desc: 'Scan for expired services, broken references, and missing coordinates',
                    icon: (
                      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                        <path d="M10 2L3 5v5c0 4.5 3 7.5 7 8 4-0.5 7-3.5 7-8V5l-7-3z" />
                        <polyline points="7 10 9 12 13 8" />
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
              {tab === 'free' ? <FreeQueryEditor /> : tab === 'scenarios' ? <ScenarioLab /> : <FeedValidator />}
            </div>
          </div>
        )}
      </main>

      <footer className="mt-12 border-t border-[var(--color-border)]">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-center gap-3">
          <span className="text-sm text-[var(--color-text-muted)]">Created by Krystyna Szurmanska</span>
          <a
            href="https://github.com/krystynaszur/gtfs-query-lab"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View source on GitHub"
            className="text-[var(--color-text-muted)] hover:text-[var(--color-transit-green)] transition-colors"
          >
            <svg viewBox="0 0 16 16" className="w-5 h-5" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
          </a>
        </div>
      </footer>
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
