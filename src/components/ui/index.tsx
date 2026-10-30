import type { ReactNode } from 'react';

/** Page title row used by every screen: title, one line of help text, and the primary actions on the right. */
export function PageHeader({ title, description, actions, id }: { title: string; description?: ReactNode; actions?: ReactNode; id?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-fg">{title}</h1>
        {description && <p id={id} className="text-sm text-muted mt-0.5">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

export type Tone = 'neutral' | 'brand' | 'ok' | 'danger' | 'warn' | 'info';
export function Badge({ tone = 'neutral', icon, children, title, className = '' }: { tone?: Tone; icon?: string; children: ReactNode; title?: string; className?: string }) {
  return (
    <span className={`badge badge-${tone} ${className}`} title={title}>
      {icon && <i className={`fa-solid ${icon} text-[9px]`} />}{children}
    </span>
  );
}

export function EmptyState({ icon, title, hint, action }: { icon: string; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center py-12 px-4 gap-3">
      <div className="w-12 h-12 rounded-full bg-subtle text-faint flex items-center justify-center text-lg"><i className={`fa-solid ${icon}`} /></div>
      <div>
        <p className="font-medium text-fg">{title}</p>
        {hint && <p className="text-sm text-muted mt-0.5">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="p-4 space-y-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => <div key={i} className="h-10 rounded-lg shimmer" />)}
    </div>
  );
}

export function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      {children}
      {hint && <p className="hint mt-1">{hint}</p>}
    </div>
  );
}

/** Toggle row with a title and a one-line explanation (feature access, preferences). */
export function CheckRow({ id, checked, onChange, title, hint }: { id: string; checked: boolean; onChange: (v: boolean) => void; title: string; hint: string }) {
  return (
    <label htmlFor={id} className="flex items-start gap-3 cursor-pointer py-1">
      <input type="checkbox" id={id} checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-4 w-4 rounded border-line-strong accent-[rgb(var(--brand))]" />
      <span>
        <span className="block text-sm font-medium text-fg">{title}</span>
        <span className="block text-xs text-muted">{hint}</span>
      </span>
    </label>
  );
}

/** Segmented control with optional counts (e.g. "Available 12"). */
export function SegmentedTabs<T extends string>({ value, onChange, options, label, wrap = true }: {
  value: T; onChange: (v: T) => void; label: string;
  options: { value: T; label: string; count?: number; id?: string }[];
  /** Options flow onto more lines instead of scrolling sideways, so none is cut off at the edge (pass false to keep one scrolling row). */
  wrap?: boolean;
}) {
  return (
    <div role="tablist" aria-label={label} className={`max-w-full rounded-lg bg-subtle p-0.5 text-sm ${wrap ? 'flex flex-wrap w-fit gap-0.5' : 'inline-flex overflow-x-auto no-scrollbar'}`}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} id={o.id} type="button" role="tab" aria-selected={on} onClick={() => onChange(o.value)}
            className={`px-3 h-8 rounded-md whitespace-nowrap font-medium transition flex items-center gap-1.5 ${on ? 'bg-surface text-fg shadow-card' : 'text-muted hover:text-fg'}`}>
            {o.label}
            {o.count !== undefined && <span className={`text-[11px] px-1.5 rounded-full ${on ? 'bg-brand/20 text-brand-text' : 'bg-line text-muted'}`}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: () => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} title={label} disabled={disabled} onClick={onChange}
      className={`relative inline-flex h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${checked ? 'bg-ok' : 'bg-line-strong'}`}>
      <span className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
  );
}

export function SearchInput({ id, value, onChange, placeholder }: { id?: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative w-full sm:w-72">
      <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-faint text-xs" />
      <input id={id} type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="input pl-9 pr-8" />
      {value && (
        <button type="button" onClick={() => onChange('')} title="Clear search" aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 text-faint hover:text-fg">
          <i className="fa-solid fa-xmark text-xs" />
        </button>
      )}
    </div>
  );
}

/** Previous / Next under a server-paged list. Hidden while everything fits on one page. */
export function Pager({ id, page, size, total, totalPages, count, onPage }: { id?: string; page: number; size: number; total: number; totalPages: number; count: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null;
  const from = total === 0 ? 0 : page * size + 1;
  const to = total === 0 ? 0 : Math.min(total, page * size + count);
  return (
    <div id={id} className="list-pager flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs text-muted border-t border-line">
      <span data-pager-info>Showing {from}-{to} of {total}</span>
      <div className="flex items-center gap-2">
        <button type="button" data-pager-prev disabled={page <= 0} onClick={() => onPage(page - 1)} className="btn btn-secondary btn-sm">Previous</button>
        <span data-pager-page className="font-medium text-fg">Page {page + 1} of {totalPages}</span>
        <button type="button" data-pager-next disabled={page + 1 >= totalPages} onClick={() => onPage(page + 1)} className="btn btn-primary btn-sm">Next</button>
      </div>
    </div>
  );
}
