import { Badge } from '../../components/ui';
import type { InventoryItem } from '../inventory/api';
import { NEGATIVE_HINT, isNegative, packNameOf, packSizeOf, fmtNum } from '../inventory/rules';
import type { MenuItem } from '../menu/api';
import { DISH_STATE_LABEL, stockText, type DishState } from './rules';

const STATE: Record<DishState, { tone: 'ok' | 'neutral' | 'danger'; label: string; hint: string }> = {
  live: { tone: 'ok', label: DISH_STATE_LABEL.live, hint: 'Billing takes the linked stock' },
  'cost-only': { tone: 'neutral', label: DISH_STATE_LABEL['cost-only'], hint: 'Every linked item is issued by hand' },
  problem: { tone: 'danger', label: DISH_STATE_LABEL.problem, hint: 'A link cannot be converted, so it takes no stock' },
  none: { tone: 'neutral', label: DISH_STATE_LABEL.none, hint: 'Selling this dish does not change any stock' },
};

const base = 'card w-full text-left p-3 flex flex-col gap-1.5 transition';
const ring = (focus?: boolean, selected?: boolean) => (focus ? 'ring-2 ring-brand border-brand' : selected ? 'ring-2 ring-brand/60' : 'hover:border-brand');

/** One dish in the diagram or the list. A focus card is not a button; the others refocus the diagram on tap. */
export function DishCard({ dish, state, links, focus, onClick }: { dish: MenuItem; state: DishState; links: number; focus?: boolean; onClick?: () => void }) {
  const s = STATE[state];
  const body = (
    <>
      <span className="flex items-start justify-between gap-2">
        <span className="min-w-0"><span className="block text-[11px] uppercase tracking-wide text-muted"><i className="fa-solid fa-utensils mr-1" />Dish{dish.categoryName ? ` · ${dish.categoryName}` : ''}</span>
          <span className="block font-semibold text-fg break-words">{dish.name}</span></span>
        <Badge tone={s.tone} title={s.hint}>{s.label}</Badge>
      </span>
      <span className="text-xs text-muted">₹{Number(dish.price || 0).toFixed(2)} · {links === 0 ? 'no stock linked' : `${links} stock item${links === 1 ? '' : 's'}`}</span>
    </>
  );
  if (focus || !onClick) return <div data-node="dish" data-id={dish.id} className={`${base} ${ring(focus)}`}>{body}</div>;
  return <button type="button" onClick={onClick} data-node="dish" data-id={dish.id} title={`Show how ${dish.name} is connected`} className={`${base} ${ring()}`}>{body}</button>;
}

/** One stock item: how much is in stock, in packs too, whether it is reduced by sales, and how many dishes use it. */
export function ItemCard({ item, usedBy, focus, onClick }: { item: InventoryItem; usedBy: number; focus?: boolean; onClick?: () => void }) {
  const ps = packSizeOf(item);
  const body = (
    <>
      <span className="flex items-start justify-between gap-2">
        <span className="min-w-0"><span className="block text-[11px] uppercase tracking-wide text-muted"><i className="fa-solid fa-boxes-stacked mr-1" />Stock item</span>
          <span className="block font-semibold text-fg break-words">{item.name}</span></span>
        <span className="flex flex-wrap justify-end gap-1">
          {isNegative(item) ? <Badge tone="danger" title={NEGATIVE_HINT}>ADD PURCHASE</Badge> : item.lowStock && <Badge tone="danger">LOW</Badge>}
          {item.expiryStatus === 'EXPIRED' && <Badge tone="danger">EXPIRED</Badge>}
          {item.expiryStatus === 'SOON' && <Badge tone="warn">EXPIRES SOON</Badge>}
          {item.autoDeduct === false && <Badge tone="neutral" title="Issued by hand: selling dishes does not reduce this stock">MANUAL</Badge>}
        </span>
      </span>
      <span className={`text-sm font-medium ${item.lowStock ? 'text-danger' : 'text-ok'}`}>{stockText(item)}</span>
      {item.nextExpiryDate && (
        <span className={`text-xs block flex items-center gap-1.5 ${item.expiryStatus === 'EXPIRED' ? 'text-danger font-semibold' : item.expiryStatus === 'SOON' ? 'text-warn font-semibold' : 'text-muted'}`}>
          <i className="fa-solid fa-hourglass-half" />
          <span>FIFO Expiry: {item.nextExpiryDate} {item.expiringQuantity ? `(${fmtNum(item.expiringQuantity)} ${item.unit})` : ''}</span>
        </span>
      )}
      <span className="text-xs text-muted">counted in {item.unit}{ps > 0 ? ` · 1 ${packNameOf(item)} = ${fmtNum(ps)} ${item.unit}` : ''} · {usedBy === 0 ? 'no dish uses it' : `used by ${usedBy} dish${usedBy === 1 ? '' : 'es'}`}</span>
    </>
  );
  if (focus || !onClick) return <div data-node="item" data-id={item.id} className={`${base} ${ring(focus)}`}>{body}</div>;
  return <button type="button" onClick={onClick} data-node="item" data-id={item.id} title={`Show every dish that uses ${item.name}`} className={`${base} ${ring()}`}>{body}</button>;
}
