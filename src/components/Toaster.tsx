import { useEffect } from 'react';
import { useToast } from './toast';

const STYLE = {
  success: 'fa-circle-check text-ok',
  error: 'fa-circle-xmark text-danger',
  warning: 'fa-triangle-exclamation text-warn',
  info: 'fa-circle-info text-info',
} as const;

/** Same element ids as the classic app's toast (#toast, #toastMsg); the e2e suite reads them. */
export function Toaster() {
  const { message, type, visible, seq, dismiss } = useToast();

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(dismiss, type === 'error' ? 6000 : 4000);
    return () => clearTimeout(t);
  }, [visible, seq, type, dismiss]);

  return (
    <div
      id="toast"
      data-testid="toast"
      role="status"
      aria-live="polite"
      onClick={dismiss}
      title="Click to dismiss"
      className={`fixed z-[80] top-4 left-4 right-4 sm:left-auto sm:right-5 sm:top-5 sm:max-w-sm transition-all duration-200 bg-surface border border-line shadow-pop rounded-xl px-4 py-3 flex items-center gap-3 text-sm cursor-pointer select-none ${
        visible ? 'translate-y-0 opacity-100 pointer-events-auto' : '-translate-y-3 opacity-0 pointer-events-none'
      }`}
    >
      <i id="toastIcon" className={`fa-solid ${STYLE[type]} text-base shrink-0`} />
      <span id="toastMsg" className="font-medium text-fg flex-1 min-w-0">{message}</span>
      <button type="button" onClick={(e) => { e.stopPropagation(); dismiss(); }} className="text-faint hover:text-fg shrink-0" title="Dismiss notification" aria-label="Dismiss notification">
        <i className="fa-solid fa-xmark text-xs" />
      </button>
    </div>
  );
}
