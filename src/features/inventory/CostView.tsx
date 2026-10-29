import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { showToast } from '../../components/toast';
import { Badge, EmptyState, Field, Skeleton } from '../../components/ui';
import { useSafeMutation as useMutation } from '../../lib/useSafeMutation';
import { costAlertsKey, saveCostAlertSettings, type CostAlertSettings } from './api';
import { useCostAlerts } from './hooks';
import { changeText } from './stockops';

const rupee = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

function Settings({ initial }: { initial: CostAlertSettings }) {
  const qc = useQueryClient();
  const [change, setChange] = useState(String(initial.changeThresholdPercent));
  const [floor, setFloor] = useState(String(initial.marginFloorPercent));
  const save = useMutation({
    mutationFn: () => saveCostAlertSettings({ changeThresholdPercent: Number(change), marginFloorPercent: Number(floor) }),
    onSuccess: () => { showToast('Alert limits saved', 'success'); void qc.invalidateQueries({ queryKey: costAlertsKey }); },
    onError: (e: Error) => showToast(e.message, 'error'),
  });
  return (
    <form className="card p-4 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      <Field id="costChangePct" label="Alert when a price moves by (%)" hint="between the last two purchases"><input id="costChangePct" type="number" min={1} max={200} step="any" value={change} onChange={(e) => setChange(e.target.value)} className="input w-28" /></Field>
      <Field id="costMarginFloor" label="Dish margin should be at least (%)" hint="profit as a share of the price"><input id="costMarginFloor" type="number" min={0} max={95} step="any" value={floor} onChange={(e) => setFloor(e.target.value)} className="input w-28" /></Field>
      <button type="submit" id="btnSaveCostLimits" disabled={save.isPending} className="btn btn-primary h-10">Save limits</button>
    </form>
  );
}

/** Ingredient prices that moved, and dishes that earn too little. */
export function CostView() {
  const q = useCostAlerts();
  if (q.isPending) return <div className="card"><Skeleton rows={5} /></div>;
  if (q.isError) return <p className="card p-6 text-center text-sm text-danger">Failed to load cost alerts: {q.error.message}</p>;
  const d = q.data;
  return (
    <div id="costView" className="space-y-4">
      <Settings key={`${d.changeThresholdPercent}-${d.marginFloorPercent}`} initial={{ changeThresholdPercent: d.changeThresholdPercent, marginFloorPercent: d.marginFloorPercent }} />

      <div className="card overflow-hidden">
        <div className="p-4 border-b border-line"><h3 className="font-medium text-fg">Ingredient price changes</h3><p className="text-sm text-muted">Compares what you paid on the last two purchases of each item (price per stock unit, before GST).</p></div>
        {d.changes.length === 0 ? <EmptyState icon="fa-circle-check" title={`No price moved by ${d.changeThresholdPercent}% or more`} /> : (
          <table className="rtable">
            <thead><tr><th>Ingredient</th><th>Supplier</th><th className="text-right">Before</th><th className="text-right">Now</th><th className="text-right">Change</th><th>Used in</th></tr></thead>
            <tbody id="costChangesBody">{d.changes.map((c) => (
              <tr key={c.itemId} data-cost-change={c.name}>
                <td data-label="" className="cell-title font-medium text-fg">{c.name}</td><td data-label="Supplier" className="text-muted">{c.supplier || '-'}</td>
                <td data-label="Before" className="md:text-right text-muted">{rupee(c.previousCost)}<span className="text-xs"> / {c.unit}</span></td>
                <td data-label="Now" className="md:text-right font-medium">{rupee(c.latestCost)}<span className="text-xs text-muted"> / {c.unit}</span></td>
                <td data-label="Change" className="md:text-right"><Badge tone={c.direction === 'UP' ? 'danger' : 'ok'} icon={c.direction === 'UP' ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'}>{changeText(c.changePercent)}</Badge></td>
                <td data-label="Used in" className="text-xs text-muted">{c.dishes.length ? c.dishes.slice(0, 4).join(', ') + (c.dishes.length > 4 ? ` +${c.dishes.length - 4}` : '') : 'no dish yet'}</td>
              </tr>))}</tbody>
          </table>)}
      </div>

      <div className="card overflow-hidden">
        <div className="p-4 border-b border-line"><h3 className="font-medium text-fg">Dishes with a thin margin</h3><p className="text-sm text-muted">Dishes with a recipe whose profit is under {d.marginFloorPercent}% of the price. Raise the price or lower the cost.</p></div>
        {d.lowMargin.length === 0 ? <EmptyState icon="fa-circle-check" title={`Every dish with a recipe earns at least ${d.marginFloorPercent}%`} /> : (
          <table className="rtable">
            <thead><tr><th>Dish</th><th className="text-right">Price</th><th className="text-right">Cost</th><th className="text-right">Profit</th><th className="text-right">Margin</th><th>Price rise in</th></tr></thead>
            <tbody id="lowMarginBody">{d.lowMargin.map((m) => (
              <tr key={m.menuItemId} data-low-margin={m.name}>
                <td data-label="" className="cell-title font-medium text-fg">{m.name}</td>
                <td data-label="Price" className="md:text-right">{rupee(m.price)}</td><td data-label="Cost" className="md:text-right text-muted">{rupee(m.cost)}</td>
                <td data-label="Profit" className={`md:text-right font-semibold ${m.profit < 0 ? 'text-danger' : ''}`}>{rupee(m.profit)}</td>
                <td data-label="Margin" className="md:text-right"><Badge tone={m.status === 'NEGATIVE' ? 'danger' : 'warn'}>{m.status === 'NEGATIVE' ? 'Sells below cost' : `${m.marginPercent}%`}</Badge></td>
                <td data-label="Price rise in" className="text-xs text-muted">{m.affectedBy.length ? m.affectedBy.join(', ') : '-'}</td>
              </tr>))}</tbody>
          </table>)}
      </div>
    </div>
  );
}
