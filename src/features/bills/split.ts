import type { SplitBillRequest } from '../printing/api';
import type { BillItem } from './types';

/** Which bill each unit of each line of the order goes on: `assign[lineId][n]` units on bill n+1. The last bill always holds the rest. */
export type Assignment = Record<number, number[]>;

export const MIN_BILLS = 2;
export const MAX_BILLS = 6;

/** Lines that can be placed on a bill: the ones with something ordered and a server id. */
export const splittable = (items: BillItem[]): (BillItem & { id: number })[] =>
  items.filter((i): i is BillItem & { id: number } => i.id != null && Number(i.quantity) > 0);

const emptyRow = (count: number, rest: number) => Array.from({ length: count }, (_, n) => (n === count - 1 ? rest : 0));

/** Everything starts on the last bill ("the balance"); the cashier moves what the other guests ate onto the earlier bills. */
export function initialAssignment(items: BillItem[], count: number): Assignment {
  const out: Assignment = {};
  for (const l of splittable(items)) out[l.id] = emptyRow(count, l.quantity);
  return out;
}

/** The same placement on a different number of bills: what no longer fits falls back onto the last bill. */
export function resize(assign: Assignment, items: BillItem[], count: number): Assignment {
  const out: Assignment = {};
  for (const l of splittable(items)) {
    const was = assign[l.id] ?? [];
    // the old last entry was "the rest", not a bill of its own: only the bills before it carry over
    const row = was.slice(0, Math.min(Math.max(0, was.length - 1), count - 1));
    while (row.length < count - 1) row.push(0);
    const placed = row.reduce((s, q) => s + q, 0);
    out[l.id] = [...row, l.quantity - placed];
  }
  return out;
}

/** Put `qty` units of a line on bill `bill` (0-based); more than is left is cut to what is left. The last bill is never set directly. */
export function setUnits(assign: Assignment, line: BillItem & { id: number }, bill: number, qty: number, count: number): Assignment {
  if (bill >= count - 1) return assign;
  const row = [...(assign[line.id] ?? emptyRow(count, line.quantity))];
  const others = row.slice(0, count - 1).reduce((s, q, n) => (n === bill ? s : s + q), 0);
  row[bill] = Math.max(0, Math.min(Math.floor(qty), line.quantity - others));
  row[count - 1] = line.quantity - others - row[bill];
  return { ...assign, [line.id]: row };
}

/** A line of one unit goes wholly to one bill. */
export function moveWhole(assign: Assignment, line: BillItem & { id: number }, bill: number, count: number): Assignment {
  const row = emptyRow(count, 0);
  row[bill] = line.quantity;
  return { ...assign, [line.id]: row };
}

export const unitsOn = (assign: Assignment, bill: number) => Object.values(assign).reduce((s, row) => s + (row[bill] ?? 0), 0);

/** Every bill needs at least one item. */
export const everyBillHasItems = (assign: Assignment, count: number) => Array.from({ length: count }, (_, n) => unitsOn(assign, n) > 0).every(Boolean);

export function toRequest(assign: Assignment, count: number): SplitBillRequest {
  return {
    portions: Array.from({ length: count }, (_, n) => ({
      items: Object.entries(assign).filter(([, row]) => (row[n] ?? 0) > 0).map(([id, row]) => ({ billItemId: Number(id), quantity: row[n] })),
    })),
  };
}
