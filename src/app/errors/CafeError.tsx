import type { ReactNode } from 'react';
import copy from './errorCopy.json';

type Copy = { mood: string; label: string; title: string; text: string };
export type ErrorCode = '403' | '404' | '500' | 'crash';

/** The friendly error card: the same cup drawings and wording as the pages nginx serves for errors (public/errors). */
export function CafeError({ code, actions, fullPage = false }: { code: ErrorCode; actions: ReactNode; fullPage?: boolean }) {
  const c = (copy as Record<string, Copy>)[code];
  return (
    <div data-error-page={code} className={`${fullPage ? 'min-h-screen' : 'min-h-[60vh]'} grid place-items-center px-4 py-8`}>
      <section role="alert" className="card w-full max-w-xl text-center p-6 sm:p-10">
        <img src={`/errors/cup-${c.mood}.svg`} alt="" width={190} height={190} className="mx-auto w-36 sm:w-44 h-auto -mb-1" />
        <span className="inline-block my-2 px-3.5 py-1.5 rounded-full bg-brand/15 text-brand-text text-xs font-extrabold uppercase tracking-widest">{code === 'crash' ? c.label : `Error ${code} · ${c.label}`}</span>
        <h1 className="text-2xl sm:text-4xl font-extrabold text-fg leading-tight">{c.title}</h1>
        <p className="mt-2.5 text-muted max-w-[46ch] mx-auto">{c.text}</p>
        <div className="mt-6 flex flex-wrap gap-2.5 justify-center">{actions}</div>
      </section>
    </div>
  );
}
