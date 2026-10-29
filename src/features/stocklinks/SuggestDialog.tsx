import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog } from '../../components/Dialog';
import { showToast } from '../../components/toast';
import type { InventoryItem } from '../inventory/api';
import { inventoryKey } from '../inventory/api';
import type { MenuItem } from '../menu/api';
import { createLink, createStockItem } from './api';
import { itemsToCreate, suggestLinks, type Graph, type Suggestion } from './rules';

/**
 * Suggested links for dishes that have none yet (a burger takes a bun, a sandwich two slices, a bottle itself). Nothing is
 * changed until Apply: the list can be edited by ticking, and missing stock items are created with 0 in stock.
 */
export function SuggestDialog({ dishes, items, graph, onClose }: { dishes: MenuItem[]; items: InventoryItem[]; graph: Graph; onClose: () => void }) {
  const qc = useQueryClient();
  const all = suggestLinks(dishes, items, graph);
  const [off, setOff] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const chosen = all.filter((s) => !off.has(s.dishId));
  const make = itemsToCreate(chosen);
  const groups = [...all.reduce((m, s) => m.set(s.ruleLabel, [...(m.get(s.ruleLabel) ?? []), s]), new Map<string, Suggestion[]>())];
  const toggle = (id: number) => setOff((o) => { const n = new Set(o); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const apply = async () => {
    setBusy(true);
    let linked = 0; let failed = 0; let created = 0;
    const ids = new Map<string, number>();
    try {
      for (const t of make) {
        try { ids.set(t.name.toLowerCase().replace(/\s+/g, ' ').trim(), (await createStockItem({ name: t.name, unit: t.unit })).id); created++; } catch { /* its dishes are counted as failed below */ }
      }
      for (const s of chosen) {
        const id = s.existingId ?? (s.create ? ids.get(s.create.name.toLowerCase().replace(/\s+/g, ' ').trim()) : undefined);
        if (!id) { failed++; continue; }
        try { await createLink(s.dishId, id, s.qty, s.unit); linked++; } catch { failed++; }
      }
    } finally {
      setBusy(false);
      void qc.invalidateQueries({ queryKey: ['recipe'] });
      void qc.invalidateQueries({ queryKey: inventoryKey });
    }
    showToast(`Linked ${linked} dish${linked === 1 ? '' : 'es'}${created ? `, made ${created} stock item${created === 1 ? '' : 's'}` : ''}${failed ? `. ${failed} could not be linked` : ''}`, failed ? 'warning' : 'success');
    if (linked > 0 || failed === 0) onClose();
  };

  return (
    <Dialog id="suggestModal" open onClose={onClose} size="lg" title="Suggested links" description="For dishes with no link yet. Untick anything that is wrong; nothing changes until you apply.">
      {all.length === 0 ? <p id="suggestEmpty" className="text-sm text-muted py-6 text-center">Every dish that fits a rule already has a link, or none match. You can still link any dish by hand.</p> : (
        <div className="space-y-4">
          <p id="suggestSummary" className="text-sm text-fg">{chosen.length} of {all.length} dishes selected{make.length > 0 && <> · will make {make.length} stock item{make.length === 1 ? '' : 's'} with 0 in stock: <span className="font-medium">{make.map((t) => t.name).join(', ')}</span></>}</p>
          <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
            {groups.map(([label, list]) => (
              <div key={label} className="rounded-lg border border-line">
                <p className="px-3 py-2 text-sm font-medium text-fg bg-subtle rounded-t-lg">{label} <span className="text-muted font-normal">· {list.length}</span></p>
                {list[0].note && <p className="px-3 pt-2 text-xs text-muted">{list[0].note}</p>}
                <ul className="divide-y divide-line">
                  {list.map((s) => (
                    <li key={s.dishId}><label htmlFor={`sg-${s.dishId}`} className="flex items-center gap-3 px-3 py-2 min-h-11 cursor-pointer hover:bg-subtle/60">
                      <input id={`sg-${s.dishId}`} data-suggest={s.dishId} type="checkbox" checked={!off.has(s.dishId)} onChange={() => toggle(s.dishId)} className="h-4 w-4 accent-[rgb(var(--brand))] shrink-0" />
                      <span className="min-w-0 flex-1"><span className="block text-sm text-fg truncate">{s.dishName}</span><span className="block text-xs text-muted">{s.category}</span></span>
                      <span className="text-xs text-right text-muted shrink-0">{s.qty} {s.unit} of<br /><span className="text-fg font-medium">{s.create ? s.create.name : items.find((i) => i.id === s.existingId)?.name}</span>{s.create && <span className="badge badge-brand ml-1">new</span>}</span>
                    </label></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex gap-2"><button type="button" id="btnSuggestAll" onClick={() => setOff(new Set())} className="btn btn-secondary btn-sm">Select all</button><button type="button" id="btnSuggestNone" onClick={() => setOff(new Set(all.map((s) => s.dishId)))} className="btn btn-secondary btn-sm">Select none</button></span>
            <button type="button" id="btnApplySuggestions" disabled={busy || chosen.length === 0} onClick={() => void apply()} className="btn btn-primary"><i className="fa-solid fa-wand-magic-sparkles" />{busy ? 'Applying…' : `Apply ${chosen.length} link${chosen.length === 1 ? '' : 's'}`}</button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
