import { useState, useEffect } from 'react';

interface QueryEditorProps {
  defaultValue?: string;
  value?: string;
  onChange?: (sql: string) => void;
  onRun: (sql: string) => void;
  loading?: boolean;
  readOnly?: boolean;
}

export function QueryEditor({
  defaultValue = '',
  value,
  onChange,
  onRun,
  loading = false,
  readOnly = false,
}: QueryEditorProps) {
  const [internal, setInternal] = useState(defaultValue);
  const controlled = value !== undefined;
  const sql = controlled ? value : internal;

  useEffect(() => {
    if (!controlled) setInternal(defaultValue);
  }, [defaultValue, controlled]);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    if (controlled) onChange?.(e.target.value);
    else setInternal(e.target.value);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!loading && sql.trim()) onRun(sql);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={sql}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        readOnly={readOnly}
        spellCheck={false}
        rows={6}
        style={{
          backgroundColor: 'var(--color-code-bg)',
          color: 'var(--color-code-text)',
          borderColor: 'var(--color-code-border)',
        }}
        className={[
          'w-full font-mono text-sm px-4 py-3 rounded-xl resize-y border',
          'focus:outline-none focus:border-[var(--color-brand)]',
          readOnly ? 'opacity-80 cursor-default' : '',
        ].join(' ')}
        placeholder="SELECT * FROM stops LIMIT 10"
      />
      {!readOnly && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--color-text-muted)]">
            <kbd className="px-1.5 py-0.5 bg-[var(--color-subtle)] border border-[var(--color-border)] rounded text-[10px]">Ctrl</kbd>
            {' + '}
            <kbd className="px-1.5 py-0.5 bg-[var(--color-subtle)] border border-[var(--color-border)] rounded text-[10px]">Enter</kbd>
            {' to run'}
          </span>
          <button
            onClick={() => onRun(sql)}
            disabled={loading || !sql.trim()}
            className={[
              'px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors',
              loading || !sql.trim()
                ? 'bg-[var(--color-border)] text-[var(--color-text-muted)] cursor-not-allowed'
                : 'bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white',
            ].join(' ')}
          >
            {loading ? 'Running…' : 'Run'}
          </button>
        </div>
      )}
    </div>
  );
}
