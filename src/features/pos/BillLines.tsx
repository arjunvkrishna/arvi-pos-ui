import { Badge } from '../../components/ui';
import type { BillItem } from '../bills/types';
import { formatModifiersSnapshot } from './billText';

const inr = (n: number) => `₹${n.toFixed(2)}`;

/** What was ordered on a bill, one line per dish: quantity, name, any note or modifiers, and the line total. Read only. */
export function BillLines({ items, id, className = '' }: { items?: BillItem[]; id?: string; className?: string }) {
  const lines = (items || []).filter((i) => Number(i.quantity) > 0);
  return (
    <ul id={id} className={`divide-y divide-line ${className}`}>
      {lines.map((i, k) => {
        const extras = formatModifiersSnapshot(i.modifiersSnapshot, i.comboSnapshot);
        return (
          <li key={i.id ?? k} className="flex items-start justify-between gap-3 py-2 text-sm">
            <span className="min-w-0 [overflow-wrap:anywhere]">
              <span className="font-semibold">{i.quantity}×</span> {i.itemName || i.menuItemName}
              {i.isTakeaway && <> <Badge tone="brand">PARCEL</Badge></>}
              {extras && <span className="block text-xs text-brand-text">{extras}</span>}
              {i.customization?.trim() ? <span className="block text-xs italic text-muted">{i.customization.trim()}</span> : null}
            </span>
            <span className="shrink-0 text-muted">{inr(Number(i.subtotal ?? i.totalPrice ?? Number(i.price) * Number(i.quantity)))}</span>
          </li>
        );
      })}
    </ul>
  );
}
