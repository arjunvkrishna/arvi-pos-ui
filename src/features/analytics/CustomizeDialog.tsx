import { Dialog } from '../../components/Dialog';
import { PRESETS, WIDGETS, isShown, moveWidget, sameLayout, toggleWidget, type Layout } from './layout';

/** Choose which sections the page shows and in what order. Changes apply at once and are remembered for this user in this browser. */
export function CustomizeDialog({ open, onClose, layout, onChange }: { open: boolean; onClose: () => void; layout: Layout; onChange: (l: Layout) => void }) {
  const def = (id: string) => WIDGETS.find((w) => w.id === id)!;
  const shown = layout.order.length - layout.hidden.length;
  return (
    <Dialog id="analyticsCustomizeModal" open={open} onClose={onClose} size="lg" title="Customize analytics" description="Show only what you need and put it in the order you like. This is saved for you on this device.">
      <div className="space-y-4">
        <div>
          <p className="text-xs font-medium text-muted mb-1.5">Start from a ready-made view</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {PRESETS.map((p) => <button key={p.id} type="button" data-preset={p.id} onClick={() => onChange(p.layout)} aria-pressed={sameLayout(layout, p.layout)} className={`text-left rounded-lg border p-2.5 ${sameLayout(layout, p.layout) ? 'border-brand bg-subtle' : 'border-line'}`}><b className="block text-sm text-fg">{p.label}</b><span className="text-xs text-muted">{p.description}</span></button>)}
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-muted mb-1.5">{shown} of {layout.order.length} sections shown</p>
          <ul id="analyticsCustomizeList" className="rounded-lg border border-line divide-y divide-line max-h-[50vh] overflow-y-auto">
            {layout.order.map((id, k) => { const w = def(id); const on = isShown(layout, id); return (
              <li key={id} data-widget-row={id} className="flex items-center gap-2 p-2">
                <label className="flex items-center gap-2.5 flex-1 min-w-0 min-h-[40px] cursor-pointer">
                  <input type="checkbox" checked={on} onChange={() => onChange(toggleWidget(layout, id))} className="w-5 h-5 shrink-0" aria-label={`Show ${w.title}`} />
                  <span className="min-w-0"><span className={`block text-sm truncate ${on ? 'text-fg' : 'text-muted'}`}>{w.title}</span><span className="block text-[11px] text-faint truncate">{w.group}</span></span>
                </label>
                <button type="button" data-move="up" disabled={k === 0} onClick={() => onChange(moveWidget(layout, id, -1))} aria-label={`Move ${w.title} up`} className="btn btn-secondary btn-sm w-10 h-10 p-0"><i className="fa-solid fa-arrow-up" /></button>
                <button type="button" data-move="down" disabled={k === layout.order.length - 1} onClick={() => onChange(moveWidget(layout, id, 1))} aria-label={`Move ${w.title} down`} className="btn btn-secondary btn-sm w-10 h-10 p-0"><i className="fa-solid fa-arrow-down" /></button>
              </li>); })}
          </ul>
        </div>
        <div className="flex justify-between gap-2">
          <button type="button" id="btnAnalyticsResetLayout" onClick={() => onChange(PRESETS[0].layout)} className="btn btn-secondary">Reset to default</button>
          <button type="button" onClick={onClose} className="btn btn-primary">Done</button>
        </div>
      </div>
    </Dialog>
  );
}
