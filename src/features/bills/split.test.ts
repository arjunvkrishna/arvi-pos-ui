import { describe, expect, it } from 'vitest';
import type { BillItem } from './types';
import { everyBillHasItems, initialAssignment, moveWhole, resize, setUnits, toRequest, unitsOn } from './split';

const item = (id: number, quantity: number): BillItem & { id: number } => ({ id, itemName: `Dish ${id}`, quantity, price: 100, subtotal: 100 * quantity });
const items = [item(1, 2), item(2, 1), item(3, 3)];

describe('splitting a bill by items', () => {
  it('starts with everything on the last bill', () => {
    const a = initialAssignment(items, 2);
    expect(a[1]).toEqual([0, 2]);
    expect(unitsOn(a, 0)).toBe(0);
    expect(everyBillHasItems(a, 2)).toBe(false);
  });

  it('moves units to an earlier bill and leaves the balance on the last', () => {
    let a = initialAssignment(items, 2);
    a = setUnits(a, items[0], 0, 1, 2);
    a = moveWhole(a, items[1], 0, 2);
    expect(a[1]).toEqual([1, 1]);
    expect(a[2]).toEqual([1, 0]);
    expect(everyBillHasItems(a, 2)).toBe(true);
  });

  it('never places more than was ordered', () => {
    let a = initialAssignment(items, 3);
    a = setUnits(a, items[2], 0, 2, 3);
    a = setUnits(a, items[2], 1, 5, 3);
    expect(a[3]).toEqual([2, 1, 0]);
    a = setUnits(a, items[2], 0, -4, 3);
    expect(a[3]).toEqual([0, 1, 2]);
  });

  it('cannot set the last bill directly', () => {
    const a = initialAssignment(items, 2);
    expect(setUnits(a, items[0], 1, 0, 2)).toBe(a);
  });

  it('keeps the placement when the number of bills changes, the rest falls to the last bill', () => {
    let a = initialAssignment(items, 3);
    a = setUnits(a, items[0], 0, 1, 3);
    a = setUnits(a, items[0], 1, 1, 3);
    expect(a[1]).toEqual([1, 1, 0]);
    const two = resize(a, items, 2);
    expect(two[1]).toEqual([1, 1]);
    const four = resize(two, items, 4);
    expect(four[1]).toEqual([1, 0, 0, 1]);
    for (const row of Object.values(four)) expect(row).toHaveLength(4);
  });

  it('asks the server for exactly what was placed, every unit once', () => {
    let a = initialAssignment(items, 2);
    a = setUnits(a, items[0], 0, 1, 2);
    a = moveWhole(a, items[1], 0, 2);
    const req = toRequest(a, 2);
    expect(req.portions[0].items).toEqual([{ billItemId: 1, quantity: 1 }, { billItemId: 2, quantity: 1 }]);
    expect(req.portions[1].items).toEqual([{ billItemId: 1, quantity: 1 }, { billItemId: 3, quantity: 3 }]);
    const placed = req.portions.flatMap((p) => p.items).reduce((s, i) => s + i.quantity, 0);
    expect(placed).toBe(6);
  });

  it('ignores lines with nothing ordered or without an id', () => {
    const a = initialAssignment([...items, { itemName: 'Gone', quantity: 0, price: 1, subtotal: 0, id: 9 }, { itemName: 'No id', quantity: 1, price: 1, subtotal: 1 }], 2);
    expect(Object.keys(a)).toEqual(['1', '2', '3']);
  });
});
