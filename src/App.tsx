import { DBProvider, useDB } from './contexts/DBContext';
import { FeedLoader } from './components/FeedLoader';
import { FeedStats } from './components/FeedStats';

function AppShell() {
  const { db, loadFeed } = useDB();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold tracking-tight">GTFS Query Lab</h1>
            <p className="text-xs text-gray-400 mt-0.5">SQL query optimization on real transit data</p>
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
              className="text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              Load different feed
            </button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {!db ? (
          <FeedLoader />
        ) : (
          <div className="space-y-6">
            <FeedStats />
            {/* Day 3+: QueryEditor and ScenarioLab go here */}
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
