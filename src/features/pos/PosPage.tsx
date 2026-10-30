import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '../../api/session';
import { canPrintBill } from '../../auth/tabs';
import { fetchProfile } from '../attendance/api';
import { showToast } from '../../components/toast';
import { useEventStream } from '../../lib/useEventStream';
import { useSafeMutation as useMutation } from '../../lib/useSafeMutation';
import type { Bill } from '../bills/types';
import { billsKey } from '../bills/api';
import { fetchGst, fetchParcel, gstKey, parcelKey } from '../gst/api';
import { useCategories, useMenuAutoRefresh, useMenuItems } from '../menu/hooks';
import { printBill, printKot } from '../printing/api';
import { trackPrintJob, warnIfPrinterOffline } from '../printing/jobs';
import { usePrintUi } from '../printing/store';
import { shiftKey } from '../shift/api';
import {
  activeKey, cancelOrder, changeLocation, confirmPayment, createTable, deleteTable, fetchActive, fetchNextToken, fetchTables, printBillOnly, reprintKot, requestBill, saveOrder, sendKot, tablesKey, tokenKey,
  type ChangeLocationBody, type DiningTable, type SaveOrderPayload,
} from './api';
import { CartPanel, type CartVm } from './CartPanel';
import { DishGrid } from './DishGrid';
import { MobileBar, PlaceBar, type Place } from './Places';
import { isNetworkProblem } from '../../offline/connection';
import { canQueue } from '../../offline/outbox';
import { useOutbox } from '../../offline/outboxStore';
import { AddTableDialog, CancelOrderDialog, ConfirmPaymentDialog, ManageTablesDialog, MoveOrderDialog, PlacePickerDialog } from './PosDialogs';
import { ActiveOrdersDialog } from './ActiveOrdersDialog';
import { ModifierModal } from '../modifiers/ModifierModal';
import { fetchModifiersForMenuItem, fetchCombosForMenuItem, menuItemModifiersKey, menuItemCombosKey } from '../modifiers/api';
import {
  addLine, cartTotals, configuredGst, phoneDigits, discountPending, discountProblem, DEFAULT_TABLES, draftFromOrder, gstPercent, gstSplit, hasOrderChanges, IN_BILL_FLOW, isManagerRole, locationReady, noteWithPrefix, num, orderGates, orderKey, orderMode, transferBlocked, upsertOrder,
  type CartLine, type Draft, type DishRef, type Mode,
} from './rules';

const TABLE_CACHE = 'arvi_pos_tables';
const cachedTables = (): string[] => { try { const v = JSON.parse(localStorage.getItem(TABLE_CACHE) || 'null'); return Array.isArray(v) && v.length ? v : DEFAULT_TABLES; } catch { return DEFAULT_TABLES; } };
const placeKey = (p: Place, o: Bill | null) => `${p.mode}|${p.table}|${p.orderId ?? ''}|${orderKey(o)}`;
/** The live stream tells this screen when something changes; this slow refresh only covers a stream that silently dropped. */
const SAFETY_NET_MS = 120_000;
const bump = (qc: ReturnType<typeof useQueryClient>) => { void qc.invalidateQueries({ queryKey: activeKey }); void qc.invalidateQueries({ queryKey: billsKey }); void qc.invalidateQueries({ queryKey: shiftKey }); };

export function PosPage() {
  const user = useSession((s) => s.user)!;
  const isManager = isManagerRole(user.role);
  const qc = useQueryClient();

  useMenuAutoRefresh();
  const menuQ = useMenuItems();
  const catQ = useCategories();
  const gstQ = useQuery({ queryKey: gstKey, queryFn: fetchGst, staleTime: 60_000, retry: false });
  const parcelQ = useQuery({ queryKey: parcelKey, queryFn: fetchParcel, staleTime: 60_000, retry: false });
  const tablesQ = useQuery({ queryKey: tablesKey, queryFn: fetchTables, staleTime: 30_000 });
  const activeQ = useQuery({ queryKey: activeKey, queryFn: fetchActive, refetchInterval: SAFETY_NET_MS, refetchOnWindowFocus: true });   // the live stream below pushes changes; this is only a safety net
  useEventStream({ path: '/bills/stream', event: 'orders-changed', enabled: true, onSignal: () => { void qc.invalidateQueries({ queryKey: activeKey }); }, onConnected: () => { void qc.invalidateQueries({ queryKey: activeKey }); } });

  const cfg = gstQ.data ?? null;
  const defaultParcel = Number(parcelQ.data?.defaultParcelCharge) || 10;
  const menu: DishRef[] = useMemo(() => (menuQ.data ?? []).map((m) => ({ id: m.id, name: m.price != null ? m.name : m.name, price: m.price, isVeg: m.isVeg })), [menuQ.data]);
  const tableRows: DiningTable[] = useMemo(() => tablesQ.data ?? [], [tablesQ.data]);
  const floorOf: Record<string, string> = useMemo(() => Object.fromEntries(tableRows.filter((t) => t.floor).map((t) => [t.name, t.floor as string])), [tableRows]);
  const tables = tablesQ.data ? tablesQ.data.map((t) => t.name) : cachedTables();
  if (tablesQ.data) { try { localStorage.setItem(TABLE_CACHE, JSON.stringify(tables)); } catch { /* storage unavailable */ } }
  const orders = activeQ.data ?? [];

  const [place, setPlace] = useState<Place>({ mode: 'TABLE', table: '', orderId: null });
  const [draft, setDraft] = useState<Draft>(() => draftFromOrder(null, [], { defaultParcel: 10, key: '' }));
  const [category, setCategory] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [cartOpen, setCartOpen] = useState(false);
  const [pendingDish, setPendingDish] = useState<number | null>(null);
  const [customizingDish, setCustomizingDish] = useState<{ id: number; name: string; price: number } | null>(null);
  const [dialog, setDialog] = useState<null | { kind: 'picker'; mode: Mode; subtitle: string } | { kind: 'active' } | { kind: 'addTable' } | { kind: 'manage' } | { kind: 'move' } | { kind: 'pay'; id: number } | { kind: 'cancel'; id: number }>(null);

  const order: Bill | null = place.mode === 'TABLE'
    ? (place.table ? orders.find((o) => o.tableNumber === place.table) ?? null : null)
    : (place.orderId ? orders.find((o) => o.id === place.orderId) ?? null : null);

  const newDraft = (o: Bill | null, p: Place) => draftFromOrder(o, menu, { defaultParcel, cfg, key: placeKey(p, o) });

  // Keep the draft in step with the server: while the staff are typing nothing is replaced; otherwise another
  // device's change shows up, and an order settled elsewhere clears the screen.
  const key = placeKey(place, order);
  if (activeQ.isSuccess && draft.orderId != null && !orders.some((o) => o.id === draft.orderId)) {
    const wasInFlow = IN_BILL_FLOW.includes(draft.status);
    if (wasInFlow) queueMicrotask(() => showToast('This order was billed and settled. Ready for the next one!', 'success'));
    const next: Place = place.mode === 'TABLE' ? place : { ...place, orderId: null };
    if (next !== place) setPlace(next);
    setDraft(newDraft(null, next));
  } else if (draft.key !== key && !draft.touched) {
    setDraft(newDraft(order, place));
  }

  const isTakeawayMode = place.mode === 'TAKEAWAY';
  // Access given or taken away by a manager shows up here without signing in again (on return to the tab, or within two minutes)
  const patchUser = useSession((s) => s.patchUser);
  const access = useQuery({ queryKey: ['my-access'], queryFn: fetchProfile, refetchInterval: SAFETY_NET_MS, refetchOnWindowFocus: true, retry: false, staleTime: 0 });
  const liveCanPrint = access.data?.canPrintBill;
  useEffect(() => { if (liveCanPrint !== undefined && liveCanPrint !== user.canPrintBill) patchUser({ canPrintBill: liveCanPrint }); }, [liveCanPrint, user.canPrintBill, patchUser]);
  const canPrint = canPrintBill(user);
  const totals = cartTotals({ cart: draft.cart, mode: place.mode, isManager, canDiscount: canPrint, discount: draft.discount, gstSel: draft.gstSel, gstCustom: draft.gstCustom, parcel: draft.parcel, defaultParcel, order, cfg });
  const ready = locationReady(place.mode, place.table, draft.customer);
  const changed = hasOrderChanges({ ready, cart: draft.cart, order, mode: place.mode, customer: draft.customer, phone: draft.phone, notes: draft.notes, parcelVisible: totals.hasParcel, parcel: draft.parcel });

  const tokenQ = useQuery({ queryKey: [...tokenKey, place.mode], queryFn: () => fetchNextToken(place.mode as 'TAKEAWAY' | 'OUTDOOR'), enabled: place.mode !== 'TABLE' && !order, staleTime: 0, retry: false });
  const token = (place.mode === 'TAKEAWAY' ? order?.takeawayToken : order?.outdoorToken) || tokenQ.data || (place.mode === 'TAKEAWAY' ? 'TAK-001' : 'OUT-001');

  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p, touched: true }));
  const setLine = (i: number, p: Partial<CartLine>) => setDraft((d) => {
    const cart = d.cart.map((c, k) => (k === i ? { ...c, ...p } : c)).filter((c) => c.quantity > 0);
    return { ...d, cart, touched: true };
  });
  const removeLine = (i: number) => setDraft((d) => ({ ...d, cart: d.cart.filter((_, k) => k !== i), touched: true }));

  /** Go to another place; the screen then shows that place's order (or an empty cart). */
  const go = (next: Place, dishId?: number | null) => {
    const o = next.mode === 'TABLE' ? orders.find((x) => x.tableNumber === next.table) ?? null : next.orderId ? orders.find((x) => x.id === next.orderId) ?? null : null;
    let d = newDraft(o, next);
    if (dishId != null && o?.status !== 'BILL_PRINTED') {
      const dish = menu.find((m) => m.id === dishId);
      if (dish) { d = { ...d, cart: addLine(d.cart, dish, next.mode === 'TAKEAWAY'), touched: true }; showToast(`Added "${dish.name}"${next.table ? ` to ${next.table}` : ''}`, 'success'); }
    }
    setPlace(next); setDraft(d); setDialog(null);
  };
  const confirmDiscard = (what: string) => !(changed && !window.confirm(`You have unsaved changes in the current order. ${what} anyway?`));
  const selectTable = (t: string) => { const dish = pendingDish; setPendingDish(null); go({ mode: 'TABLE', table: t, orderId: null }, dish); if (!dish && t) showToast(`Active table set to ${t}`, 'success'); };
  const selectOrder = (o: Bill) => { const mode = orderMode(o); go(mode === 'TABLE' ? { mode, table: o.tableNumber || '', orderId: null } : { mode, table: '', orderId: o.id }); };
  const startNew = (mode: 'OUTDOOR' | 'TAKEAWAY') => {
    if (!confirmDiscard(`Start a new ${mode === 'OUTDOOR' ? 'outdoor' : 'takeaway'} order`)) return;
    const dish = pendingDish; setPendingDish(null);
    go({ mode, table: '', orderId: null }, dish);
    if (mode === 'OUTDOOR') window.setTimeout(() => document.getElementById('cartCustomer')?.focus(), 50);
  };
  const switchMode = (mode: Mode) => { if (mode === place.mode) return; go({ mode, table: '', orderId: null }); };

  const addDish = async (id: number) => {
    if (order?.status === 'BILL_PRINTED') { showToast('Bill is already printed for this table. Manager must confirm payment before placing new orders.', 'warning'); return; }
    if (place.mode === 'TABLE' && !place.table) {
      const dish = menu.find((m) => m.id === id);
      setPendingDish(id); showToast(`Please select a table to add "${dish?.name ?? 'dish'}"`, 'info');
      setDialog({ kind: 'picker', mode: 'TABLE', subtitle: `Select table for "${dish?.name ?? 'dish'}":` }); return;
    }
    if (place.mode === 'OUTDOOR' && !draft.customer.trim()) { showToast('Customer name is required for outdoor orders.', 'error'); document.getElementById('cartCustomer')?.focus(); setCartOpen(true); return; }
    const dish = menu.find((m) => m.id === id);
    if (!dish) return;
    const raw = menuQ.data?.find((m) => m.id === id);
    if (raw && (raw.isAvailable === false || raw.active === false)) { showToast(`"${dish.name}" is currently unavailable and cannot be added to orders.`, 'warning'); return; }

    try {
      // cached for a minute so tapping the same dish again does not wait on the network; saving in the admin screen refreshes it
      const [mods, combos] = await Promise.all([
        qc.fetchQuery({ queryKey: menuItemModifiersKey(dish.id), queryFn: () => fetchModifiersForMenuItem(dish.id), staleTime: 60_000 }).catch(() => []),
        qc.fetchQuery({ queryKey: menuItemCombosKey(dish.id), queryFn: () => fetchCombosForMenuItem(dish.id), staleTime: 60_000 }).catch(() => []),
      ]);
      if ((mods && mods.length > 0) || (combos && combos.length > 0)) {
        setCustomizingDish(dish);
        return;
      }
    } catch { /* best effort */ }

    setDraft((d) => ({ ...d, cart: addLine(d.cart, dish, isTakeawayMode), touched: true }));
  };

  /** Show the server's answer straight away (before the refetch) so buttons never wait on the network. */
  const adopt = async (saved: Bill, p: Place) => {
    await qc.cancelQueries({ queryKey: activeKey });
    qc.setQueryData<Bill[]>(activeKey, (l) => upsertOrder(l, saved));
    const next: Place = p.mode === 'TABLE' ? p : { ...p, orderId: saved.id };
    setPlace(next);
    setDraft({ ...draftFromOrder(saved, menu, { defaultParcel, cfg, key: placeKey(next, saved) }), gstSel: draft.gstSel, gstCustom: draft.gstCustom });
    bump(qc);
  };
  const resetPlace = (mode: Mode) => { const p: Place = { mode, table: '', orderId: null }; setPlace(p); setDraft(newDraft(null, p)); };
  const label = (o: Bill) => (orderMode(o) === 'TAKEAWAY' ? `Takeaway ${o.takeawayToken || 'TAK'}` : orderMode(o) === 'OUTDOOR' ? `${o.customerName} • ${o.outdoorToken || 'OUT'}` : `Table ${o.tableNumber}`);

  const save = useMutation({
    mutationFn: (p: SaveOrderPayload) => saveOrder(p),
    onSuccess: async (saved) => { await adopt(saved, place); void qc.invalidateQueries({ queryKey: tokenKey }); showToast(`Order for ${label(saved)} saved successfully! (Ref #${saved.billNumber})`, 'success'); },
    onError: (e: Error, p) => {
      // The server could not be reached: a brand-new order waits on this device and is sent when the connection returns
      if (isNetworkProblem(e) && canQueue(p)) {
        try {
          const item = useOutbox.getState().add(p);
          showToast(`No connection. The order for ${item.label} is saved on this device and will be sent automatically.`, 'warning');
          resetPlace(place.mode);
        } catch (full) { showToast((full as Error).message, 'error'); }
        return;
      }
      showToast(`Failed to save order: ${e.message}`, 'error');
    },
  });
  const kot = useMutation({
    mutationFn: (o: Bill) => sendKot(o.id),
    onSuccess: async (updated, target) => {
      showToast(`KOT printed for ${label(target)} (Ref #${updated.kotNumber || target.billNumber})`, 'success');
      usePrintUi.getState().openKot(updated);
      await adopt(updated, place);
      printKot(updated.id, `KOT_${updated.id}_v${updated.kotUpdateCount || 0}`).then((res) => {
        if (res?.jobId) { warnIfPrinterOffline(res); trackPrintJob(res.jobId, res.status, `KOT #${updated.kotNumber || updated.billNumber}`); }
        else if (res?.success) showToast(`KOT sent to printer (${res.host})`, 'success');
      }).catch(() => undefined);
    },
    onError: (e: Error) => showToast(`Failed to print KOT: ${e.message}`, 'error'),
  });
  const request = useMutation({
    mutationFn: (o: Bill) => requestBill(o.id),
    onSuccess: async (res) => { showToast(`Bill requested from Manager for ${label(res)} (Bill #${res.billNumber})`, 'success'); await adopt(res, place); },
    onError: (e: Error) => showToast(`Failed to request bill: ${e.message}`, 'error'),
  });
  const print = useMutation({
    mutationFn: (o: Bill) => {
      const pct = gstPercent(draft.gstSel, draft.gstCustom); const on = Boolean(cfg?.enabled && pct > 0);
      return printBillOnly(o.id, { discountPercent: num(draft.discount), gstEnabled: on, taxPercent: on ? pct : 0, cgstPercent: on ? gstSplit(pct, cfg).cgst : 0, sgstPercent: on ? gstSplit(pct, cfg).sgst : 0, parcelCharge: totals.hasParcel && num(draft.parcel, -1) >= 0 ? num(draft.parcel) : null });
    },
    onSuccess: async (printed) => {
      showToast(`Bill #${printed.billNumber} printed! Awaiting payment confirmation.`, 'success');
      await qc.cancelQueries({ queryKey: activeKey });
      qc.setQueryData<Bill[]>(activeKey, (l) => upsertOrder(l, printed));
      resetPlace(place.mode);
      bump(qc);
      usePrintUi.getState().openReceipt(printed);
      printBill(printed.id).then((res) => {
        if (res?.jobId) { warnIfPrinterOffline(res); trackPrintJob(res.jobId, res.status, `Bill #${printed.billNumber}`); }
        else if (res?.success) showToast(`Bill #${printed.billNumber} sent to printer (${res.host})`, 'success');
      }).catch(() => undefined);
    },
    onError: (e: Error) => showToast(`Error printing bill: ${e.message}`, 'error'),
  });
  const pay = useMutation({
    mutationFn: (v: {
      id: number;
      mode: string;
      notes: string;
      tip: number;
      payments?: { mode: string; amount: number }[];
      customerId?: number | null;
      redeemLoyaltyPoints?: number;
    }) => confirmPayment(v.id, v.mode, v.notes, v.tip, v.payments, v.customerId, v.redeemLoyaltyPoints),
    onSuccess: async (settled, v) => {
      showToast(`Payment confirmed & settled for Bill #${settled.billNumber}! Table released.${settled.customerPoints != null && settled.customerId ? ` ${settled.customerName || 'The customer'} now has ${settled.customerPoints} points.` : ''}`, 'success');
      setDialog(null);
      await qc.cancelQueries({ queryKey: activeKey });
      qc.setQueryData<Bill[]>(activeKey, (l) => upsertOrder(l, { ...settled, status: 'PAID' }));
      if (order?.id === v.id) resetPlace(place.mode);
      bump(qc);
    },
    onError: (e: Error) => showToast(`Failed to confirm payment: ${e.message}`, 'error'),
  });
  const addTable = useMutation({
    mutationFn: ({ name, floor }: { name: string; floor?: string }) => createTable(name, floor),
    onSuccess: (t) => { showToast(`Table ${t.name} added successfully`, 'success'); void qc.invalidateQueries({ queryKey: tablesKey }); if (dialog?.kind !== 'manage') go({ mode: 'TABLE', table: t.name, orderId: null }); },
    onError: (e: Error) => showToast(`Failed to add table: ${e.message}`, 'error'),
  });
  const removeTable = useMutation({
    mutationFn: (t: DiningTable) => deleteTable(t.id),
    onSuccess: (_r, t) => { showToast(`Table ${t.name} deleted successfully`, 'success'); void qc.invalidateQueries({ queryKey: tablesKey }); if (place.mode === 'TABLE' && place.table === t.name) resetPlace('TABLE'); },
    onError: (e: Error) => showToast(`Failed to delete table: ${e.message}`, 'error'),
  });
  // the order being transferred: the one on the billing screen, or one picked from the Active Orders list
  const [moveId, setMoveId] = useState<number | null>(null);
  const moveOrder = (moveId != null ? orders.find((o) => o.id === moveId) : null) ?? order;
  const move = useMutation({
    mutationFn: (b: ChangeLocationBody) => changeLocation(moveOrder!.id, b),
    onSuccess: async (moved, b) => {
      showToast(b.mergeIfOccupied ? `Orders merged into ${moved.billNumber} on Table ${moved.tableNumber}` : `Order #${moved.billNumber} transferred to ${label(moved)}`, 'success');
      setDialog(null); setMoveId(null);
      await qc.cancelQueries({ queryKey: activeKey });
      qc.setQueryData<Bill[]>(activeKey, (l) => upsertOrder(l, moved));
      const mode = orderMode(moved);
      const p: Place = mode === 'TABLE' ? { mode, table: moved.tableNumber || '', orderId: null } : { mode, table: '', orderId: moved.id };
      setPlace(p); setDraft(draftFromOrder(moved, menu, { defaultParcel, cfg, key: placeKey(p, moved) })); bump(qc);
    },
    onError: (e: Error) => { showToast(`Could not transfer order: ${e.message}`, 'error'); bump(qc); },
  });
  const reprint = useMutation({
    mutationFn: (o: Bill) => reprintKot(o.id).then((res) => ({ res, o })),
    onSuccess: ({ res, o }) => {
      const where = label(o);
      if (res?.jobId) { warnIfPrinterOffline(res); trackPrintJob(res.jobId, res.status, `KOT reprint #${o.kotNumber || o.billNumber}`); showToast(`KOT reprint sent for ${where}`, 'success'); }
      else if (res?.success) showToast(`KOT reprint sent to printer (${res.host})`, 'success');
      else showToast(`KOT reprint: ${res?.message || 'the printer did not accept it'}`, 'warning');
    },
    onError: (e: Error) => showToast(`Could not reprint the KOT: ${e.message}`, 'error'),
  });

  const gates = orderGates({ ready, mode: place.mode, cartCount: draft.cart.length, order, changed, saving: save.isPending, sendingKot: kot.isPending });
  /** A typed discount that was not saved must not slip into a bill: say so and stop the step. */
  const unsavedDiscount = () => { if (!canPrint || !discountPending(draft)) return false; showToast('Discount not applied. Click Save next to the discount first.', 'error'); document.getElementById('cartDiscountPct')?.focus(); return true; };
  const onApplyDiscount = () => {
    const why = discountProblem(draft.discountInput); if (why) { showToast(why, 'error'); return; }
    const n = String(Math.max(0, num(draft.discountInput)));
    setDraft((d) => ({ ...d, discount: n, discountInput: n, touched: true }));
    showToast(num(n) > 0 ? `Discount of ${n}% applied` : 'Discount removed', 'success');
  };
  const guard = (g: { disabled: boolean; title: string }) => { if (g.disabled) { showToast(g.title, 'warning'); return false; } return true; };

  const onSave = () => {
    if (!guard(gates.save) || unsavedDiscount()) return;
    const phone = phoneDigits(draft.phone);
    if (phone && phone.length < 10) { showToast('The loyalty phone number needs 10 digits. Correct it or clear it.', 'warning'); document.getElementById('cartCustomerPhone')?.focus(); setCartOpen(true); return; }
    const mode = place.mode;
    const payload: SaveOrderPayload = {
      orderId: order?.id ?? null, orderType: mode, tableNumber: mode === 'TABLE' ? place.table : null,
      customerName: draft.customer.trim() || (mode === 'TAKEAWAY' ? 'Guest' : ''),
      customerPhone: phone,
      outdoorToken: mode === 'OUTDOOR' ? order?.outdoorToken ?? null : null,
      takeawayToken: mode === 'TAKEAWAY' ? order?.takeawayToken ?? null : null,
      notes: noteWithPrefix(mode, draft.notes),
      parcelCharge: totals.hasParcel && num(draft.parcel, -1) >= 0 ? num(draft.parcel) : null,
      items: draft.cart.map((c) => ({
        menuItemId: c.item.id,
        itemName: c.item.name,
        quantity: c.quantity,
        price: c.item.price,
        customization: c.customization.trim(),
        isTakeaway: mode === 'TAKEAWAY' ? true : Boolean(c.isTakeaway),
        modifiersSnapshot: c.modifiersSnapshot,
        comboSnapshot: c.comboSnapshot,
      })),
    };
    if (isManager) {
      payload.discountPercent = Math.max(0, num(draft.discount));
      const pct = gstPercent(draft.gstSel, draft.gstCustom); const on = Boolean(cfg?.enabled && pct > 0);
      payload.gstEnabled = on; payload.taxPercent = on ? pct : 0;
      payload.cgstPercent = on ? gstSplit(pct, cfg).cgst : 0; payload.sgstPercent = on ? gstSplit(pct, cfg).sgst : 0;
    } else if (canPrint) payload.discountPercent = Math.max(0, num(draft.discount));
    save.mutate(payload);
  };
  const doCancel = (o: Bill) => {
    const id = o.id; const desc = label(o);
    qc.setQueryData<Bill[]>(activeKey, (l) => (l ?? []).filter((x) => x.id !== id));
    resetPlace(place.mode); setDialog(null);
    cancelOrder(id).then(() => { showToast(`Order for ${desc} cancelled.`, 'info'); bump(qc); }).catch((e: Error) => { showToast(`Server cancel failed: ${e.message}`, 'error'); bump(qc); });
  };
  const onClear = () => {
    if (order) {
      const cancellable = order.status === 'ACTIVE' || order.status === 'KOT_REQUESTED' || order.status === 'KOT_PRINTED';
      if (!cancellable) { showToast(`Cannot cancel — order is in "${order.status.replace(/_/g, ' ')}" stage. Complete the bill workflow first.`, 'error'); return; }
      if (order.status === 'KOT_PRINTED' || order.kotPrintedAt) { setDialog({ kind: 'cancel', id: order.id }); return; }
      if (!window.confirm(`Cancel the saved ${place.mode === 'TABLE' ? `order for Table ${order.tableNumber}` : `${place.mode.toLowerCase()} order for ${order.customerName || 'Guest'} (${order.outdoorToken || order.takeawayToken || ''})`}?
This will remove the order permanently.`)) return;
      doCancel(order);
      return;
    }
    resetPlace(place.mode);
  };
  /** Prints the last kitchen ticket again for an order being prepared (marked REPRINT); it changes nothing on the order. */
  const onReprint = (o: Bill | null = order) => {
    if (reprint.isPending) return;
    if (!o || !o.id) { showToast('No saved order to reprint.', 'warning'); return; }
    if (o.status !== 'KOT_PRINTED') { showToast('A kitchen ticket can only be reprinted while the order is being prepared.', 'warning'); return; }
    if (!window.confirm(`Reprint the kitchen ticket for ${label(o).trim()}?\n\nA copy marked REPRINT prints the last ticket again. Use it only if the kitchen did not get it.`)) return;
    reprint.mutate(o);
  };
  const onMoveClick = () => { const why = transferBlocked(order, changed); if (why) { showToast(why, 'warning'); return; } setMoveId(null); setDialog({ kind: 'move' }); };
  const onTransferFromList = (o: Bill) => { const why = transferBlocked(o, false); if (why) { showToast(why, 'warning'); return; } setMoveId(o.id); setDialog({ kind: 'move' }); };
  const onDeleteCurrentTable = () => {
    const row = tableRows.find((t) => t.name.toLowerCase() === place.table.toLowerCase());
    if (!row) { showToast(`Table ${place.table} not found in database`, 'error'); return; }
    deleteTableChecked(row);
  };
  const deleteTableChecked = (t: DiningTable) => {
    const live = orders.find((o) => o.tableNumber === t.name);
    if (live) { showToast(`Cannot delete table ${t.name} while order #${live.billNumber} is active!`, 'error'); return; }
    if (!window.confirm(`Are you sure you want to delete table "${t.name}"? It will be removed for staff and managers across all devices.`)) return;
    removeTable.mutate(t);
  };

  const gstOptions = useMemo(() => { const base = ['0', '5', '12', '18']; const c = configuredGst(cfg); return base.includes(c) ? base : [...base.slice(0, 1), c, ...base.slice(1)].sort((a, b) => Number(a) - Number(b)); }, [cfg]);
  const payOrder = dialog?.kind === 'pay' ? orders.find((o) => o.id === dialog.id) ?? null : null;
  const vm: CartVm = {
    mode: place.mode, table: place.table, tables, order, draft, totals, gates, token, isManager, canPrintBill: canPrint, gstOptions, busy: { save: save.isPending, kot: kot.isPending },
    patch, onApplyDiscount, setLine, removeLine, onMode: switchMode, onTable: (t) => go({ mode: 'TABLE', table: t, orderId: null }), onClear, onAddTable: () => setDialog({ kind: 'addTable' }), onDeleteTable: onDeleteCurrentTable, onMove: onMoveClick, onReprint: () => onReprint(), reprinting: reprint.isPending,
    onSave, onKot: () => { if (guard(gates.kot) && !unsavedDiscount() && order) kot.mutate(order); }, onRequest: () => { if (guard(gates.request) && !unsavedDiscount() && order) request.mutate(order); },
    onPrint: () => { if (guard(gates.print) && !unsavedDiscount() && order) print.mutate(order); }, onConfirm: () => { if (order) setDialog({ kind: 'pay', id: order.id }); }, onClose: () => setCartOpen(false),
  };

  const barLabel = place.mode === 'TABLE' ? place.table || 'Select table' : place.mode === 'TAKEAWAY' ? `Takeaway: ${token}` : `Outdoor: ${token}`;
  const itemCount = order?.status === 'BILL_PRINTED' ? 0 : totals.count;
  return (
    <section id="tab-pos" data-testid="tab-pos" className="space-y-3">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_24rem] gap-3 items-start">
        <div className="space-y-3 min-w-0">
          <MobileBar tables={tables} orders={orders} place={place} order={order} isManager={isManager} token={token} onTable={(t) => go({ mode: 'TABLE', table: t, orderId: null })} onPicker={(m = 'TABLE') => setDialog({ kind: 'picker', mode: m, subtitle: m === 'TABLE' ? 'Choose a dining table or switch to an outdoor / takeaway order' : `Choose a ${m.toLowerCase()} order or create a new one` })} onActive={() => setDialog({ kind: 'active' })} onAddTable={() => setDialog({ kind: 'addTable' })} onManage={() => setDialog({ kind: 'manage' })} />
          <PlaceBar tables={tables} floorOf={floorOf} orders={orders} place={place} isManager={isManager} onTable={(t) => go({ mode: 'TABLE', table: t, orderId: null })} onOrder={selectOrder} onNew={startNew}
            onActive={() => setDialog({ kind: 'active' })} onAddTable={() => setDialog({ kind: 'addTable' })} onManage={() => setDialog({ kind: 'manage' })} onRefresh={() => { void activeQ.refetch(); void tablesQ.refetch(); }} refreshing={activeQ.isFetching} />
          <DishGrid items={menuQ.data ?? []} categories={catQ.data ?? []} loading={menuQ.isPending} category={category} onCategory={setCategory} query={query} onQuery={setQuery} onAdd={addDish} />
        </div>
        <>
          {cartOpen && <div className="fixed inset-0 z-[44] bg-black/40 lg:hidden" onClick={() => setCartOpen(false)} aria-hidden="true" />}
          <aside id="posCartPanel" className={cartOpen ? 'fixed inset-x-0 bottom-0 z-[45] max-h-[92vh] flex flex-col lg:static lg:z-auto lg:max-h-none' : 'hidden lg:block lg:sticky lg:top-20'}>
            <CartPanel {...vm} />
          </aside>
        </>
      </div>

      {!cartOpen && (
        <button type="button" id="mobileFloatingCartBar" onClick={() => setCartOpen(true)} className="lg:hidden fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] inset-x-3 z-30 card shadow-pop border-brand/40 px-3 py-2.5 flex items-center justify-between gap-3 text-left">
          <span className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 rounded-xl bg-brand text-gray-950 inline-flex items-center justify-center shrink-0"><i className="fa-solid fa-cart-shopping" /></span>
            <span className="min-w-0"><span id="mobileCartTableTag" className="block text-[11px] font-semibold text-muted truncate"><span id="mobileCartTableTagName">{barLabel}</span> • <span id="mobileCartItemCount">{itemCount}</span> items</span><span id="mobileCartTotal" className="block font-bold text-brand-text">₹{(order?.status === 'BILL_PRINTED' ? order.netAmount : totals.net).toFixed(2)}</span></span>
          </span>
          <span className="btn btn-primary shrink-0"><span id="mobileFloatingCartBtnText">{draft.cart.length || order?.items?.length ? 'View order' : 'Take order'}</span><i className="fa-solid fa-chevron-up text-[10px]" /></span>
        </button>
      )}

      {dialog?.kind === 'picker' && <PlacePickerDialog initial={dialog.mode} subtitle={dialog.subtitle} tables={tables} floorOf={floorOf} orders={orders} current={place} isManager={isManager} onClose={() => { setDialog(null); setPendingDish(null); }} onTable={selectTable} onOrder={selectOrder} onNew={startNew} onAddTable={() => setDialog({ kind: 'addTable' })} onManage={() => setDialog({ kind: 'manage' })} />}
      {dialog?.kind === 'active' && <ActiveOrdersDialog orders={orders} isManager={isManager} onClose={() => setDialog(null)} onOpen={(o) => { selectOrder(o); }} onPay={(o) => setDialog({ kind: 'pay', id: o.id })} onReprint={(o) => onReprint(o)} onTransfer={onTransferFromList} />}
      {dialog?.kind === 'addTable' && <AddTableDialog busy={addTable.isPending} floors={[...new Set(Object.values(floorOf))]} onClose={() => setDialog(null)} onAdd={(name, floor) => addTable.mutate({ name, floor })} />}
      {dialog?.kind === 'manage' && <ManageTablesDialog tables={tableRows} orders={orders} busy={addTable.isPending} onClose={() => setDialog(null)} onAdd={(name, floor) => addTable.mutate({ name, floor })} onDelete={deleteTableChecked} />}
      {dialog?.kind === 'move' && moveOrder && <MoveOrderDialog order={moveOrder} tables={tables} orders={orders} busy={move.isPending} onClose={() => { setDialog(null); setMoveId(null); }} onMove={(b) => move.mutate(b)} />}
      {dialog?.kind === 'cancel' && order && order.id === dialog.id && <CancelOrderDialog order={order} busy={false} onClose={() => setDialog(null)} onConfirm={() => doCancel(order)} />}
      {dialog?.kind === 'pay' && payOrder && (
        <ConfirmPaymentDialog
          order={payOrder}
          busy={pay.isPending}
          onClose={() => setDialog(null)}
          onConfirm={(mode, notes, tip, payments, customerId, redeemPoints) =>
            pay.mutate({
              id: payOrder.id,
              mode,
              notes,
              tip,
              payments,
              customerId,
              redeemLoyaltyPoints: redeemPoints,
            })
          }
        />
      )}

      {customizingDish && (
        <ModifierModal
          dish={customizingDish}
          onClose={() => setCustomizingDish(null)}
          onConfirm={(res) => {
            setDraft((d) => ({
              ...d,
              cart: addLine(d.cart, customizingDish, isTakeawayMode, {
                price: res.price,
                modifiersSnapshot: res.modifiersSnapshot,
                comboSnapshot: res.comboSnapshot,
                modifiersDescription: res.summaryText,
              }),
              touched: true,
            }));
            setCustomizingDish(null);
          }}
        />
      )}
    </section>
  );
}
