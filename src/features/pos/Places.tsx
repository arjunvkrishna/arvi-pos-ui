import { useState } from 'react';
import type { Bill } from '../bills/types';
import { floorsIn } from './floors';
import { orderMode, statusLabel, type Mode, type StatusTone } from './rules';

export interface Place { mode: Mode; table: string; orderId: number | null }

const TONE: Record<StatusTone, string> = {
  ok: 'border-ok/40 bg-ok/10 text-ok', warn: 'border-warn/50 bg-warn/10 text-warn', info: 'border-info/40 bg-info/10 text-info',
  brand: 'border-brand/50 bg-brand/15 text-brand-text', neutral: 'border-line bg-surface text-fg',
};
const PILL: Record<StatusTone, string> = { ok: 'bg-ok/15', warn: 'bg-warn/15', info: 'bg-info/15', brand: 'bg-brand/20', neutral: 'bg-subtle' };

/** One chip for a table / outdoor / takeaway order, coloured by where the order is in its flow. */
export function OrderChip({ id, icon, iconClass = '', label, mono, order, mode, selected, onClick, compact }: {
  id?: string; icon: string; iconClass?: string; label: string; mono?: string; order?: Bill | null; mode: Mode; selected: boolean; onClick: () => void; compact?: boolean;
}) {
  const st = order ? statusLabel(order, mode, 'chip') : null;
  const tone = st ? TONE[st.tone] : TONE.neutral;
  return (
    <button type="button" id={id} onClick={onClick} aria-pressed={selected}
      className={`shrink-0 inline-flex items-center gap-1.5 rounded-lg border text-sm transition active:scale-95 ${compact ? 'h-9 px-2.5' : 'h-9 px-3'} ${tone} ${st?.pulse ? 'animate-pulse' : ''} ${selected ? 'ring-2 ring-brand font-semibold' : ''}`}>
      <i className={`fa-solid ${icon} text-[11px] ${iconClass}`} />
      <span className="font-medium text-fg">{label}</span>
      {mono && <span className="font-mono text-[11px] font-semibold">• {mono}</span>}
      {st && st.text && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${PILL[st.tone]}`}>{st.text}</span>}
    </button>
  );
}

/** "All | Ground | First floor | Terrace": narrows the tables to one floor. Shown only when the branch has floors. */
export function FloorFilter({ floors, value, onChange }: { floors: string[]; value: string; onChange: (floor: string) => void }) {
  if (floors.length === 0) return null;
  return (
    <div role="group" aria-label="Floor" data-testid="floor-filter" className="flex items-center gap-1 overflow-x-auto no-scrollbar">
      {['', ...floors].map((f) => (
        <button key={f || 'all'} type="button" aria-pressed={value === f} onClick={() => onChange(f)}
          className={`shrink-0 h-7 px-2.5 rounded-full text-xs border ${value === f ? 'bg-brand/15 border-brand text-fg font-medium' : 'border-line text-muted'}`}>{f || 'All floors'}</button>))}
    </div>
  );
}

interface BarProps {
  tables: string[]; orders: Bill[]; place: Place; isManager: boolean; floorOf?: Record<string, string>;
  onTable: (t: string) => void; onOrder: (o: Bill) => void; onNew: (m: 'OUTDOOR' | 'TAKEAWAY') => void;
  onActive: () => void; onAddTable: () => void; onManage: () => void; onRefresh: () => void; refreshing: boolean;
}

/** Desktop bar: every table, plus the live outdoor and takeaway orders. */
export function PlaceBar(p: BarProps) {
  const [floor, setFloor] = useState('');
  const floors = floorsIn(p.floorOf ?? {});
  const tables = floor ? p.tables.filter((t) => p.floorOf?.[t] === floor) : p.tables;
  const outdoor = p.orders.filter((o) => orderMode(o) === 'OUTDOOR');
  const takeaway = p.orders.filter((o) => orderMode(o) === 'TAKEAWAY');
  return (
    <div className="card p-3 space-y-2.5 hidden lg:block">
      {/* actions in a row of their own, the tables below them always on one line (they scroll sideways when there are many) */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" id="btnActiveOrders" onClick={p.onActive} className="btn btn-soft-brand btn-sm"><i className="fa-solid fa-list-check" />Active orders (<span id="activeOrdersBadgeCount">{p.orders.length}</span>)</button>
        {p.isManager && <button type="button" id="btnAddTableTop" onClick={p.onAddTable} className="btn btn-secondary btn-sm"><i className="fa-solid fa-plus" />Add table</button>}
        {p.isManager && <button type="button" id="btnManageTablesTop" onClick={p.onManage} className="btn btn-secondary btn-sm"><i className="fa-solid fa-trash-can" />Delete table</button>}
        <button type="button" id="btnRefreshOrders" onClick={p.onRefresh} className="btn btn-ghost btn-sm ml-auto" title="Refresh live orders"><i className={`fa-solid fa-arrows-rotate ${p.refreshing ? 'animate-spin' : ''}`} />Refresh</button>
      </div>
      <div className="pt-2.5 border-t border-line empty:hidden"><FloorFilter floors={floors} value={floor} onChange={setFloor} /></div>
      <div id="posTableGridBadges" className="flex flex-nowrap items-center gap-1.5 overflow-x-auto no-scrollbar min-w-0">
        {tables.map((t) => (
          <OrderChip key={t} icon="fa-chair" label={t} mode="TABLE" order={p.orders.find((o) => o.tableNumber === t)} selected={p.place.mode === 'TABLE' && p.place.table === t} onClick={() => p.onTable(t)} />
        ))}
        {tables.length === 0 && <span className="text-sm text-muted">{p.tables.length === 0 ? 'No tables yet' : 'No tables on this floor'}</span>}
      </div>
      <Row id="posOutdoorOrdersBar" label="Outdoor" icon="fa-tree" labelClass="text-ok" newLabel="New outdoor order" onNew={() => p.onNew('OUTDOOR')} listId="posOutdoorBadges" empty="No active outdoor orders">
        {outdoor.map((o) => <OrderChip key={o.id} icon="fa-tree" iconClass="text-ok" label={o.customerName || 'Guest'} mono={o.outdoorToken || 'OUT'} order={o} mode="OUTDOOR" selected={p.place.mode === 'OUTDOOR' && p.place.orderId === o.id} onClick={() => p.onOrder(o)} />)}
      </Row>
      <Row id="posTakeawayOrdersBar" label="Takeaway" icon="fa-bag-shopping" labelClass="text-brand-text" newLabel="New takeaway order" onNew={() => p.onNew('TAKEAWAY')} listId="posTakeawayBadges" empty="No active takeaway orders">
        {takeaway.map((o) => <OrderChip key={o.id} icon="fa-bag-shopping" iconClass="text-brand-text" label={o.customerName || 'Guest'} mono={o.takeawayToken || 'TAK'} order={o} mode="TAKEAWAY" selected={p.place.mode === 'TAKEAWAY' && p.place.orderId === o.id} onClick={() => p.onOrder(o)} />)}
      </Row>
    </div>
  );
}

function Row({ id, label, icon, labelClass, newLabel, onNew, listId, empty, children }: { id: string; label: string; icon: string; labelClass: string; newLabel: string; onNew: () => void; listId: string; empty: string; children: React.ReactNode[] }) {
  return (
    <div id={id} className="flex items-center gap-2 pt-2.5 border-t border-line overflow-x-auto no-scrollbar">
      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold shrink-0 ${labelClass}`}><i className={`fa-solid ${icon}`} />{label}</span>
      <button type="button" onClick={onNew} className="btn btn-secondary btn-sm shrink-0"><i className="fa-solid fa-plus" />{newLabel}</button>
      <div id={listId} className="flex items-center gap-1.5">{children.length === 0 ? <span className="text-xs text-muted italic">{empty}</span> : children}</div>
    </div>
  );
}

/** Phone / tablet bar: the active place as one tappable pill, a count of live orders, and a swipeable ribbon of tables. */
export function MobileBar(p: {
  tables: string[]; orders: Bill[]; place: Place; order: Bill | null; isManager: boolean; token: string;
  onTable: (t: string) => void; onPicker: (mode?: Mode) => void; onActive: () => void; onAddTable: () => void; onManage: () => void;
}) {
  const { place, order } = p;
  const label = place.mode === 'TAKEAWAY' ? `Takeaway: ${order?.takeawayToken || p.token}` : place.mode === 'OUTDOOR' ? `Outdoor: ${order?.outdoorToken || p.token}` : place.table ? `Table: ${place.table}` : 'Select table';
  const icon = place.mode === 'TAKEAWAY' ? 'fa-bag-shopping' : place.mode === 'OUTDOOR' ? 'fa-tree' : 'fa-chair';
  const st = order ? statusLabel(order, place.mode, 'chip') : null;
  return (
    <div id="mobileOrderControlBar" className="lg:hidden card p-2 space-y-2">
      <div className="flex items-center gap-2">
        <button type="button" id="mobileActiveTablePill" onClick={() => p.onPicker()} className={`h-9 px-3 rounded-lg border text-sm font-semibold inline-flex items-center gap-1.5 min-w-0 ${place.mode !== 'TABLE' || place.table ? TONE.warn : 'border-dashed border-brand text-brand-text'}`}>
          <i className={`fa-solid ${icon} text-[11px]`} /><span id="mobileActiveTableText" className="truncate max-w-[9.5rem]">{label}</span><i className="fa-solid fa-chevron-down text-[9px] opacity-70" />
        </button>
        {st && st.text && <span id="mobileTableStatusBadge" className={`text-[10px] font-bold px-2 py-1 rounded-full border ${TONE[st.tone]}`}>{st.text}</span>}
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" onClick={p.onActive} className="btn btn-soft-brand btn-sm"><i className="fa-solid fa-list-check" />Active (<span id="mobileActiveOrdersBadgeCount">{p.orders.length}</span>)</button>
          {p.isManager && <button type="button" id="btnMobileAddTable" onClick={p.onAddTable} className="btn btn-secondary btn-sm"><i className="fa-solid fa-plus" />Table</button>}
        </div>
      </div>
      <div id="mobileQuickTableRibbon" className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
        {p.tables.map((t) => <OrderChip key={t} icon="fa-chair" label={t} mode="TABLE" order={p.orders.find((o) => o.tableNumber === t)} selected={place.mode === 'TABLE' && place.table === t} onClick={() => p.onTable(t)} compact />)}
        <OrderChip icon="fa-tree" iconClass="text-ok" label="Outdoor" mode="OUTDOOR" selected={place.mode === 'OUTDOOR'} onClick={() => p.onPicker('OUTDOOR')} compact />
        <OrderChip icon="fa-bag-shopping" iconClass="text-brand-text" label="Takeaway" mode="TAKEAWAY" selected={place.mode === 'TAKEAWAY'} onClick={() => p.onPicker('TAKEAWAY')} compact />
        {/* Delete table on a phone: the same Manage Tables list the desktop "Delete table" button opens (managers and admins only) */}
        {p.isManager && <button type="button" onClick={p.onManage} title="Delete a table" aria-label="Delete a table" data-testid="ribbon-delete-table" className="shrink-0 inline-flex items-center gap-1.5 h-9 px-2.5 rounded-lg border border-danger/40 bg-danger/10 text-danger text-sm font-medium active:scale-95"><i className="fa-solid fa-trash-can text-[11px]" />Delete</button>}
      </div>
    </div>
  );
}
