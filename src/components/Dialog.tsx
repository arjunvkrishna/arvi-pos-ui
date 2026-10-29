import { useEffect, useRef, type ReactNode } from 'react';

interface DialogProps {
  /** Keeps the classic element ids (e.g. notificationsModal) so the parity suite can find the dialog. */
  id: string;
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Forced dialogs (password change) cannot be dismissed. */
  dismissible?: boolean;
  /** A tile shown before the title (an icon). */
  icon?: ReactNode;
  /** Shown next to the title (a live count, a status). */
  badge?: ReactNode;
}

const WIDTH = { sm: 'sm:max-w-sm', md: 'sm:max-w-md', lg: 'sm:max-w-lg', xl: 'sm:max-w-5xl' } as const;

/**
 * Modal dialog: centred card on tablets and up, bottom sheet on phones. Backdrop click and Escape close it,
 * focus moves in and returns afterwards.
 */
export function Dialog({ id, open, onClose, title, description, children, size = 'md', dismissible = true, icon, badge }: DialogProps) {
  const panel = useRef<HTMLDivElement>(null);

  // Callers pass a new onClose on every render; keep it in a ref so the effect below runs once per open
  // (otherwise focus would be re-grabbed on each render and never returned to the opener).
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissible) { closeRef.current(); return; }
      if (e.key !== 'Tab' || !panel.current) return;
      // keep keyboard focus inside the dialog
      const items = [...panel.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter((el) => el.offsetParent !== null);
      if (items.length === 0) { e.preventDefault(); return; }
      const first = items[0]; const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previous?.focus?.(); };
  }, [open, dismissible]);

  if (!open) return null;
  return (
    <div
      id={id}
      data-testid={id}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-[2px] sm:p-4 anim-fade-in"
      onMouseDown={(e) => { if (e.target === e.currentTarget && dismissible) onClose(); }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`dialog-panel bg-surface border border-line shadow-pop outline-none w-full ${WIDTH[size]} max-h-[92vh] flex flex-col rounded-t-2xl sm:rounded-2xl`}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 shrink-0">
          <div className="min-w-0 flex items-start gap-3">
            {icon && <div aria-hidden="true" className="shrink-0 w-11 h-11 rounded-xl bg-brand/15 text-brand-text flex items-center justify-center text-lg">{icon}</div>}
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-fg flex flex-wrap items-center gap-x-2 gap-y-1">{title}{badge}</h2>
              {description && <p className="text-sm text-muted mt-0.5">{description}</p>}
            </div>
          </div>
          {dismissible && (
            <button type="button" onClick={onClose} aria-label="Close" className="btn btn-ghost btn-icon btn-sm -mr-1.5 -mt-1">
              <i className="fa-solid fa-xmark" />
            </button>
          )}
        </div>
        <div className="px-5 pb-5 overflow-y-auto safe-bottom sm:pb-5">{children}</div>
      </div>
    </div>
  );
}
