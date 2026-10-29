import { useEffect, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog } from '../../components/Dialog';
import { showToast } from '../../components/toast';
import { Badge, EmptyState, Field, SegmentedTabs, Skeleton } from '../../components/ui';
import { saveBlob } from '../../lib/download';
import { formatISTDateTime } from '../../lib/time';
import { useSafeMutation as useMutation } from '../../lib/useSafeMutation';
import { correctVariance, exportCsv, fetchAnalysis, fetchAnomalySettings, recordTransfer, saveAnomalySettings, type DrawerQuery, type ShiftItem } from './drawerApi';
import { TRANSFER_TYPES, cashiers, correctionProblem, effectiveCount, effectiveVariance, fmt, hasFlags, signed, transferProblem, varianceTone, varianceWord, visibleShifts } from './drawerRules';
import { PERIODS, defaultCustomRange, customRangeProblem } from './rules';

const DRAWER_PERIODS = PERIODS.filter(([p]) => ['TODAY', 'YESTERDAY', 'THIS_WEEK', 'THIS_MONTH', 'LAST_MONTH', 'CUSTOM'].includes(p));
type Modal = { kind: 'ledger'; id: number } | { kind: 'transfer'; id: number | null } | { kind: 'correct'; item: ShiftItem } | { kind: 'rules' } | null;

function Formula({ id, label, value, sign }: { id: string; label: string; value: number; sign?: string }) {
  return <div className="rounded-lg bg-subtle px-3 py-2 text-center"><p className="text-[11px] text-muted whitespace-nowrap">{sign} {label}</p><p id={id} className="text-sm font-semibold text-fg">{fmt(value)}</p></div>;
}

export function DrawerTab() {
  const qc = useQueryClient();
  const [period, setPeriod] = useState('THIS_MONTH');
  const [range, setRange] = useState(defaultCustomRange());
  const [applied, setApplied] = useState({ start: '', end: '' });
  const [f, setF] = useState({ cashierId: '', registerId: '', status: 'ALL' });
  const [onlyAnomalies, setOnlyAnomalies] = useState(false);
  const [view, setView] = useState<'shifts' | 'daily' | 'monthly'>('shifts');
  const [modal, setModal] = useState<Modal>(null);
  const close = () => setModal(null);
  const q: DrawerQuery = { period, start: applied.start, end: applied.end, ...f };
  const ready = period !== 'CUSTOM' || (!!applied.start && !!applied.end);
  const analysis = useQuery({ queryKey: ['drawer-analysis', q], queryFn: () => fetchAnalysis(q), enabled: ready });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['drawer-analysis'] }); void qc.invalidateQueries({ queryKey: ['shift'] }); };
  const exp = useMutation({ mutationFn: () => { showToast('Preparing Drawer Analysis CSV export...', 'info'); return exportCsv(q); }, onSuccess: ({ blob }) => { saveBlob(blob, `ARVI_Drawer_Analysis_${period}_${new Date().toISOString().slice(0, 10)}.csv`); showToast('CSV export downloaded successfully', 'success'); }, onError: (e: Error) => showToast(`Failed to export CSV: ${e.message}`, 'error') });

  const d = analysis.data;
  const s = d?.summary ?? {};
  const shifts = d?.shifts ?? [];
  const flagged = shifts.filter(hasFlags);
  const net = Number(s.netVariance || 0);
  const dist = s.distinctions ?? {};
  const err = analysis.isError ? analysis.error.message : '';
  useEffect(() => { if (err) showToast(`Error loading drawer analysis: ${err}`, 'error'); }, [err]);
  const apply = () => { const p = customRangeProblem(range.start, range.end); if (p) { showToast(p, 'warning'); return; } setApplied(range); };
  const none = (cols: number, text: string) => <tr><td colSpan={cols} className="text-center text-sm text-muted py-6">{text}</td></tr>;

  return (
    <div id="analytics-sub-drawer" className="space-y-5">
      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-medium text-fg">Expected drawer cash</h2><Badge tone="brand"><span id="drawerFormulaPeriodBadge">{d ? `${d.startDate || ''} to ${d.endDate || ''}` : 'Active filter'}</span></Badge></div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          <Formula id="formulaFloat" label="Opening float" value={Number(s.totalOpeningFloat || 0)} /><Formula id="formulaCashSales" label="Cash sales" value={Number(s.totalCashSales || 0)} sign="+" /><Formula id="formulaCashIn" label="Cash added" value={Number(s.totalCashAdded || 0)} sign="+" />
          <Formula id="formulaCashRefunds" label="Cash refunds" value={Number(s.totalCashRefunds || 0)} sign="−" /><Formula id="formulaCashOut" label="Petty cash out" value={Number(s.totalCashPaidOut || 0)} sign="−" /><Formula id="formulaTransfersOut" label="Drawer to bank/safe" value={Number(s.totalTransfersToBankSafe || 0)} sign="−" />
          <Formula id="formulaTransfersIn" label="Bank/safe to drawer" value={Number(s.totalTransfersFromBankSafe || 0)} sign="+" /><Formula id="formulaExpectedTotal" label="Expected drawer cash" value={Number(s.totalExpectedCash || 0)} sign="=" />
        </div>
      </div>

      <div className="card p-3 flex flex-wrap items-end gap-2">
        <div id="drawerPeriodPills" className="max-w-full overflow-x-auto no-scrollbar"><SegmentedTabs label="Drawer period" value={period} onChange={setPeriod} options={DRAWER_PERIODS.map(([v, l]) => ({ value: v, label: l, id: `dpill-${v}` }))} /></div>
        {period === 'CUSTOM' && <div id="drawerCustomDateBox" className="flex items-end gap-2 flex-wrap"><Field id="drawerStartDate" label="From"><input id="drawerStartDate" type="date" value={range.start} onChange={(e) => setRange({ ...range, start: e.target.value })} className="input" /></Field><Field id="drawerEndDate" label="To"><input id="drawerEndDate" type="date" value={range.end} onChange={(e) => setRange({ ...range, end: e.target.value })} className="input" /></Field><button type="button" onClick={apply} className="btn btn-primary h-10">Apply</button></div>}
        <div className="flex flex-wrap items-center gap-2 ml-auto">
          <select id="drawerFilterCashier" value={f.cashierId} onChange={(e) => setF({ ...f, cashierId: e.target.value })} className="input w-40" aria-label="Cashier"><option value="">All cashiers</option>{cashiers(shifts).map(([id, name]) => <option key={id} value={id}>{name} (ID: {id})</option>)}</select>
          <select id="drawerFilterRegister" value={f.registerId} onChange={(e) => setF({ ...f, registerId: e.target.value })} className="input w-36" aria-label="Register"><option value="">All registers</option><option value="REG-01">REG-01</option><option value="REG-02">REG-02</option></select>
          <select id="drawerFilterStatus" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className="input w-36" aria-label="Status"><option value="ALL">All statuses</option><option value="CLOSED">Closed only</option><option value="OPEN">Open only</option></select>
          <label className="flex items-center gap-1.5 text-sm text-fg cursor-pointer"><input id="drawerFilterAnomaliesOnly" type="checkbox" checked={onlyAnomalies} onChange={(e) => setOnlyAnomalies(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--brand))]" />Anomalies only</label>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" id="btnDrawerTransfer" onClick={() => setModal({ kind: 'transfer', id: null })} className="btn btn-secondary"><i className="fa-solid fa-money-bill-transfer" />Record bank/safe transfer</button>
        <button type="button" id="btnDrawerRules" onClick={() => setModal({ kind: 'rules' })} className="btn btn-secondary"><i className="fa-solid fa-sliders" />Anomaly rules</button>
        <button type="button" id="btnDrawerRefresh" onClick={refresh} className="btn btn-ghost"><i className="fa-solid fa-rotate" />Refresh</button>
        <button type="button" id="btnDrawerCsv" onClick={() => exp.mutate(undefined)} disabled={exp.isPending} className="btn btn-secondary"><i className="fa-solid fa-file-csv" />Export CSV</button>
      </div>

      {!ready ? <div className="card"><EmptyState icon="fa-calendar-days" title="Choose a start and end date, then press Apply" /></div> : analysis.isPending ? <div className="card"><Skeleton rows={5} /></div> : (<>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="card p-4"><p className="text-xs text-muted">Expected drawer cash</p><p id="kpiDrawerExpected" className="text-2xl font-semibold text-fg mt-1">{fmt(s.totalExpectedCash)}</p><p className="text-xs text-muted mt-1">Opening float: <b id="kpiDrawerOpeningFloat" className="text-fg">{fmt(s.totalOpeningFloat)}</b></p></div>
          <div className="card p-4"><p className="text-xs text-muted">Physical counted cash</p><p id="kpiDrawerCounted" className="text-2xl font-semibold text-fg mt-1">{fmt(s.totalCountedCash)}</p><p id="kpiDrawerClosedCount" className="text-xs text-muted mt-1">{s.closedShifts || 0} Shifts</p></div>
          <div id="kpiDrawerVarianceCard" className="card p-4"><p className="text-xs text-muted flex items-center gap-2">Net shift variance <Badge tone={varianceTone(net)}><span id="kpiDrawerVarianceBadge">{varianceWord(net)}</span></Badge></p><p id="kpiDrawerNetVariance" className={`text-2xl font-semibold mt-1 ${net === 0 ? 'text-ok' : net > 0 ? 'text-warn' : 'text-danger'}`}>{signed(net)}</p>
            <p className="text-xs text-muted mt-1"><span id="kpiDrawerShortageSub">Shortages: {s.shortageCount || 0} (-{fmt(s.totalShortageAmount)})</span> · <span id="kpiDrawerSurplusSub">Surpluses: {s.surplusCount || 0} (+{fmt(s.totalSurplusAmount)})</span></p></div>
          <div className="card p-4"><p className="text-xs text-muted">Transfers to bank / safe</p><p id="kpiDrawerTransfersOut" className="text-2xl font-semibold text-fg mt-1">{fmt(s.totalTransfersToBankSafe)}</p><p className="text-xs text-muted mt-1">Into drawer: <b id="kpiDrawerTransfersIn" className="text-fg">{fmt(s.totalTransfersFromBankSafe)}</b></p></div>
          <div className="card p-4"><p className="text-xs text-muted">Non-drawer sales (separate tender)</p><p id="kpiDrawerNonCashSales" className="text-2xl font-semibold text-fg mt-1">{fmt(Number(s.totalUpiSales || 0) + Number(s.totalCardSales || 0))}</p><p className="text-xs text-muted mt-1">UPI: <b id="kpiDrawerUpiSales" className="text-fg">{fmt(s.totalUpiSales)}</b> · Card: <b id="kpiDrawerCardSales" className="text-fg">{fmt(s.totalCardSales)}</b></p></div>
          <div className="card p-4 sm:col-span-2 lg:col-span-3"><p className="text-xs font-medium text-muted mb-2">Independent ledger baselines</p><div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
            {[['distinctionDrawerFlow', 'Net drawer cash flow', 'Physical currency change in till', dist.drawerCashFlow], ['distinctionBankReloc', 'Bank & safe relocations', 'Transfers to bank accounts / safe vault', dist.bankSafeTransfers], ['distinctionExpenses', 'Cafe operating expenses', 'Rent, supplies, maintenance', dist.businessExpenses], ['distinctionProfit', 'Accounting operating profit', 'Net customer sales minus business expenses', dist.accountingProfit]].map(([id, label, help, v]) => <div key={String(id)}><p className="text-muted">{label}</p><p id={String(id)} className="font-semibold text-fg">{fmt(v as number)}</p><p className="text-[11px] text-faint">{help}</p></div>)}</div></div>
        </div>

        {flagged.length > 0 && (
          <div id="drawerAnomaliesBanner" className="rounded-xl border border-danger/40 bg-danger/5 p-4 space-y-2">
            <h3 className="text-sm font-medium text-danger"><i className="fa-solid fa-triangle-exclamation mr-1.5" />Flagged shift discrepancies & anomalies (<span id="drawerAnomaliesCount">{flagged.length}</span>) <span className="text-xs font-normal text-muted">· manager review recommended</span></h3>
            <div id="drawerAnomaliesList" className="space-y-2">{flagged.flatMap((item) => (item.anomalyFlags ?? []).map((fl, i) => (
              <div key={`${item.shift.id}-${i}`} className="rounded-lg border border-line bg-surface p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
                <p className="flex items-start gap-2"><span className={`badge shrink-0 ${fl.severity === 'HIGH' ? 'bg-danger text-white' : 'badge-warn'}`}>{fl.severity}: {fl.flagType}</span><span className="text-fg"><b>Shift #{item.shift.id} ({item.shift.cashierName || 'Staff'} - {item.shift.registerId || 'REG-01'}):</b> {fl.description}</span></p>
                <button type="button" onClick={() => setModal({ kind: 'ledger', id: item.shift.id })} className="btn btn-secondary btn-sm shrink-0">Inspect shift →</button></div>)))}</div>
          </div>)}

        <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-medium text-fg">Shift reconciliation</h3><p className="text-sm text-muted">Individual shifts, physical counts and cash movements.</p></div>
          <SegmentedTabs label="Drawer view" value={view} onChange={setView} options={[{ value: 'shifts', label: 'Shifts', id: 'btnDViewShifts' }, { value: 'daily', label: 'Daily', id: 'btnDViewDaily' }, { value: 'monthly', label: 'Monthly', id: 'btnDViewMonthly' }]} /></div>

        <div className="card overflow-x-auto">
          {view === 'shifts' && <div id="drawerTableContainerShifts"><table className="rtable min-w-[1100px] md:min-w-[1100px]"><thead><tr><th>Shift</th><th>Cashier / reg</th><th>Timeline</th><th className="text-right">Opening</th><th className="text-right">Cash sales</th><th className="text-right">Cash in</th><th className="text-right">Refunds</th><th className="text-right">Petty out</th><th className="text-right">Bank/safe out</th><th className="text-right">Bank/safe in</th><th className="text-right">Expected</th><th className="text-right">Counted</th><th>Variance</th><th>Anomalies</th><th className="text-center">Actions</th></tr></thead>
            <tbody id="drawerShiftsTableBody">{(() => { const rows = visibleShifts(shifts, onlyAnomalies); return rows.length === 0 ? none(15, 'No shifts found matching selected filters.') : rows.map((item) => {
              const sh = item.shift; const open = sh.status === 'OPEN'; const v = Number(sh.variance || 0);
              return (
                <tr key={sh.id} className={hasFlags(item) ? 'bg-danger/5' : ''}>
                  <td data-label="Shift" className="whitespace-nowrap"><b className="text-fg">#{sh.id}</b> <Badge tone={open ? 'warn' : 'ok'}>{sh.status}</Badge>{sh.previousShiftId && <span className="block text-[11px] text-faint font-mono">From #{sh.previousShiftId}</span>}</td>
                  <td data-label="Cashier" className="whitespace-nowrap"><span className="font-medium text-fg block">{sh.cashierName || 'Staff'}</span><span className="text-[11px] text-muted font-mono">{sh.registerId || 'REG-01'}</span></td>
                  <td data-label="Timeline" className="whitespace-nowrap text-[11px] text-muted font-mono">{sh.openedAt ? formatISTDateTime(sh.openedAt) : '-'}{sh.closedAt ? <span className="block">Closed: {formatISTDateTime(sh.closedAt)} ({item.durationMinutes || 0}m)</span> : <span className="block text-warn">Active shift</span>}</td>
                  <td data-label="Opening" className="md:text-right font-mono">{fmt(sh.openingFloat)}</td><td data-label="Cash sales" className="md:text-right font-mono text-ok font-semibold">{fmt(sh.cashSales)}</td><td data-label="Cash in" className="md:text-right font-mono text-info">{fmt(sh.cashInTotal)}</td>
                  <td data-label="Refunds" className="md:text-right font-mono text-danger">{fmt(sh.cashRefunds)}</td><td data-label="Petty out" className="md:text-right font-mono text-warn">{fmt(sh.cashOutTotal)}</td>
                  <td data-label="Bank/safe out" className="md:text-right font-mono">{Number(sh.transfersOutTotal) > 0 ? `-${fmt(sh.transfersOutTotal)}` : fmt(0)}</td><td data-label="Bank/safe in" className="md:text-right font-mono">{Number(sh.transfersInTotal) > 0 ? `+${fmt(sh.transfersInTotal)}` : fmt(0)}</td>
                  <td data-label="Expected" className="md:text-right font-mono font-semibold text-brand-text">{fmt(sh.expectedCash)}</td>
                  <td data-label="Counted" className="md:text-right font-mono">{open ? <i className="text-muted">Open</i> : fmt(sh.countedCash)}{sh.isCorrected && <span className="block text-[11px] text-warn" title={`Corrected count: ${fmt(sh.correctedCountedCash)}`}><i className="fa-solid fa-pen-to-square" /> {fmt(sh.correctedCountedCash)}</span>}</td>
                  <td data-label="Variance">{open ? '-' : <Badge tone={varianceTone(v)}>{signed(v)}</Badge>}</td>
                  <td data-label="Anomalies">{hasFlags(item) ? <button type="button" onClick={() => setModal({ kind: 'ledger', id: sh.id })} className="badge badge-danger" title={(item.anomalyFlags ?? []).map((x) => x.description).join(' | ')}><i className="fa-solid fa-triangle-exclamation" />{item.anomalyFlags!.length} flag{item.anomalyFlags!.length > 1 ? 's' : ''}</button> : <span className="text-xs text-muted"><i className="fa-solid fa-check text-ok" /> Clear</span>}</td>
                  <td className="cell-actions"><div className="flex items-center justify-center gap-1.5 w-full md:w-auto">
                    <button type="button" onClick={() => setModal({ kind: 'ledger', id: sh.id })} title="View full transaction ledger" aria-label={`Ledger of shift ${sh.id}`} className="btn btn-secondary btn-icon btn-sm"><i className="fa-solid fa-receipt" /></button>
                    {open ? <button type="button" onClick={() => setModal({ kind: 'transfer', id: sh.id })} title="Record bank / safe transfer" aria-label={`Transfer for shift ${sh.id}`} className="btn btn-soft-brand btn-icon btn-sm"><i className="fa-solid fa-money-bill-transfer" /></button>
                      : <button type="button" onClick={() => setModal({ kind: 'correct', item })} title="Correct counted cash" aria-label={`Correct count of shift ${sh.id}`} className="btn btn-ghost btn-icon btn-sm"><i className="fa-solid fa-pen-to-square" /></button>}
                  </div></td>
                </tr>); }); })()}</tbody></table></div>}
          {view === 'daily' && <div id="drawerTableContainerDaily"><table className="rtable min-w-[1100px] md:min-w-[1100px]"><thead><tr><th>Date</th><th>Shifts</th><th className="text-right">Opening total</th><th className="text-right">Cash sales</th><th className="text-right">UPI & card</th><th className="text-right">Cash refunds</th><th className="text-right">Cash in</th><th className="text-right">Petty out</th><th className="text-right">To bank/safe</th><th className="text-right">To drawer</th><th className="text-right">Expected</th><th className="text-right">Counted</th><th>Net variance</th><th>Discrepancies</th></tr></thead>
            <tbody id="drawerDailyTableBody">{(d?.dailySummaries ?? []).length === 0 ? none(14, 'No daily aggregate data available.') : (d?.dailySummaries ?? []).map((r) => { const v = Number(r.netVariance || 0); return <tr key={r.date}><td data-label="" className="cell-title font-semibold text-fg">{r.date}</td><td data-label="Shifts">{r.shiftCount}</td><td data-label="Opening" className="md:text-right font-mono">{fmt(r.openingTotal)}</td><td data-label="Cash sales" className="md:text-right font-mono text-ok">{fmt(r.cashSales)}</td><td data-label="UPI & card" className="md:text-right font-mono text-info">{fmt(Number(r.upiSales || 0) + Number(r.cardSales || 0))}</td><td data-label="Refunds" className="md:text-right font-mono text-danger">{fmt(r.cashRefunds)}</td><td data-label="Cash in" className="md:text-right font-mono">{fmt(r.cashIn)}</td><td data-label="Petty out" className="md:text-right font-mono text-warn">{fmt(r.cashOut)}</td><td data-label="To bank/safe" className="md:text-right font-mono">{fmt(r.transfersOut)}</td><td data-label="To drawer" className="md:text-right font-mono">{fmt(r.transfersIn)}</td><td data-label="Expected" className="md:text-right font-mono font-semibold text-brand-text">{fmt(r.expectedTotal)}</td><td data-label="Counted" className="md:text-right font-mono">{fmt(r.countedTotal)}</td><td data-label="Variance"><Badge tone={varianceTone(v)}>{signed(v)}</Badge></td><td data-label="Discrepancies" className="text-xs">{r.shortageCount > 0 && <span className="text-danger font-semibold mr-1.5">{r.shortageCount} Short</span>}{r.surplusCount > 0 && <span className="text-warn font-semibold">{r.surplusCount} Surplus</span>}{r.shortageCount === 0 && r.surplusCount === 0 && <span className="text-ok">0 Discrepancy</span>}</td></tr>; })}</tbody></table></div>}
          {view === 'monthly' && <div id="drawerTableContainerMonthly"><table className="rtable"><thead><tr><th>Month</th><th>Total shifts</th><th className="text-right">Total opening float</th><th className="text-right">Total cash sales</th><th className="text-right">Total expected cash</th><th className="text-right">Total physical counted</th><th>Net variance</th><th>Shortages / surpluses</th></tr></thead>
            <tbody id="drawerMonthlyTableBody">{(d?.monthlySummaries ?? []).length === 0 ? none(8, 'No monthly trends data available.') : (d?.monthlySummaries ?? []).map((r) => { const v = Number(r.netVariance || 0); return <tr key={r.monthYear}><td data-label="" className="cell-title font-semibold text-fg">{r.monthYear}</td><td data-label="Shifts">{r.shiftCount}</td><td data-label="Opening" className="md:text-right font-mono">{fmt(r.openingTotal)}</td><td data-label="Cash sales" className="md:text-right font-mono text-ok">{fmt(r.cashSales)}</td><td data-label="Expected" className="md:text-right font-mono font-semibold text-brand-text">{fmt(r.expectedTotal)}</td><td data-label="Counted" className="md:text-right font-mono">{fmt(r.countedTotal)}</td><td data-label="Variance"><Badge tone={varianceTone(v)}>{signed(v)}</Badge></td><td data-label="Short / surplus" className="text-xs"><span className="text-danger font-semibold mr-1.5">{r.shortageCount || 0} Short</span><span className="text-warn font-semibold">{r.surplusCount || 0} Surplus</span></td></tr>; })}</tbody></table></div>}
        </div>
      </>)}

      {modal?.kind === 'ledger' && <LedgerDialog item={shifts.find((i) => i.shift.id === modal.id)} onClose={close} onCorrect={(item) => setModal({ kind: 'correct', item })} />}
      {modal?.kind === 'transfer' && <TransferDialog shifts={shifts} preset={modal.id} onClose={close} onDone={() => { close(); refresh(); }} />}
      {modal?.kind === 'correct' && <CorrectDialog item={modal.item} onClose={close} onDone={() => { close(); refresh(); }} />}
      {modal?.kind === 'rules' && <RulesDialog onClose={close} onDone={() => { close(); refresh(); }} />}
    </div>
  );
}

function LedgerDialog({ item, onClose, onCorrect }: { item?: ShiftItem; onClose: () => void; onCorrect: (i: ShiftItem) => void }) {
  if (!item) return null;
  const sh = item.shift;
  const open = sh.status === 'OPEN';
  const v = effectiveVariance(sh);
  const rows: [string, string, string, number | undefined][] = [['dslOpeningFloat', '', 'Opening float', sh.openingFloat], ['dslCashSales', '+', 'Cash sales', sh.cashSales], ['dslCashIn', '+', 'Cash added', sh.cashInTotal], ['dslCashRefunds', '−', 'Cash refunds', sh.cashRefunds], ['dslCashOut', '−', 'Petty cash', sh.cashOutTotal], ['dslTransfersOut', '−', 'Bank/safe deposit', sh.transfersOutTotal], ['dslTransfersIn', '+', 'Bank/safe in', sh.transfersInTotal], ['dslExpectedCash', '=', 'Expected cash', sh.expectedCash]];
  const mv = sh.movements ?? [];
  return (
    <Dialog id="drawerShiftLedgerModal" open onClose={onClose} size="xl" title={`Shift #${sh.id} ledger & reconciliation`} description={<><Badge tone={open ? 'warn' : 'ok'}><span id="dslStatusBadge">{sh.status}</span></Badge> <span id="dslModalTitle" className="sr-only">Shift #{sh.id} Ledger & Reconciliation</span></>}>
      <div className="space-y-4">
        {sh.isCorrected && <div id="dslCorrectionBanner" className="rounded-lg border border-warn/40 bg-warn/10 p-3 text-sm"><p className="font-medium text-warn"><i className="fa-solid fa-pen-to-square mr-1.5" />Count corrected <span id="dslCorrectedAt">{sh.correctedAt ? formatISTDateTime(sh.correctedAt) : ''}</span></p><p id="dslCorrectionDetails" className="text-fg">Original count: {fmt(sh.countedCash)} (variance {fmt(sh.variance)}) → corrected: {fmt(sh.correctedCountedCash)} (variance {fmt(sh.correctedVariance)})</p><p id="dslCorrectionReason" className="text-muted">Reason: {sh.correctionReason || 'Verified adjustment'}</p></div>}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">{[['dslRegisterCashier', 'Register / cashier', `${sh.cashierName || 'Staff'} (${sh.registerId || 'REG-01'})`], ['dslOpenedAt', 'Opened at', sh.openedAt ? formatISTDateTime(sh.openedAt) : '-'], ['dslClosedAt', 'Closed at', sh.closedAt ? formatISTDateTime(sh.closedAt) : 'Currently open'], ['dslDuration', 'Duration', `${item.durationMinutes || 0} mins`]].map(([id, l, val]) => <div key={id}><p className="text-xs text-muted">{l}</p><p id={id} className="font-medium text-fg">{val}</p></div>)}</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{rows.map(([id, sign, label, val]) => <Formula key={id} id={id} label={label} value={Number(val || 0)} sign={sign} />)}</div>
        <div className="grid sm:grid-cols-3 gap-3 text-sm"><div className="card p-3"><p className="text-xs text-muted">Counted cash</p><p id="dslCountedCash" className="font-semibold text-fg">{open ? 'Shift open' : fmt(effectiveCount(sh))}</p></div>
          <div className="card p-3"><p className="text-xs text-muted">Variance</p><p><Badge tone={open ? 'neutral' : varianceTone(v)}><span id="dslVarianceBadge">{open ? 'OPEN' : signed(v)}</span></Badge></p></div>
          <div className="card p-3"><p className="text-xs text-muted">Non-drawer sales</p><p className="text-fg">UPI <b id="dslUpiSales">{fmt(sh.upiSales)}</b> · Card <b id="dslCardSales">{fmt(sh.cardSales)}</b> · Total <b id="dslTotalSales">{fmt(sh.totalSales)}</b></p></div></div>
        <p className="text-sm text-muted"><span id="dslHandoverRef">{sh.carryForwardRef ? `Carry-forward ref: ${sh.carryForwardRef} (previous shift #${sh.previousShiftId || 'N/A'})` : 'Standard till float setup'}</span> · <span id="dslNotes">{sh.notes || 'No closing notes recorded.'}</span></p>
        <div className="card overflow-hidden"><p className="px-4 py-3 border-b border-line text-sm font-medium text-fg">Cash movements <span id="dslMovementsCount" className="text-muted font-normal">· {mv.length}</span></p>
          <table className="rtable"><thead><tr><th>Time</th><th>Direction / type</th><th className="text-right">Amount</th><th>Account / destination</th><th>Ref / slip #</th><th>Reason</th><th>Staff</th></tr></thead>
            <tbody id="dslMovementsTableBody">{mv.length === 0 ? <tr><td colSpan={7} className="text-center text-sm text-muted py-4">No cash movements recorded on this shift.</td></tr> : mv.map((m, i) => (
              <tr key={i}><td data-label="" className="cell-title font-mono text-xs text-muted">{m.createdAt ? formatISTDateTime(m.createdAt) : '-'}</td><td data-label="Type"><Badge tone={m.movementType === 'CASH_IN' ? 'ok' : 'danger'} icon={m.movementType === 'CASH_IN' ? 'fa-arrow-down' : 'fa-arrow-up'}>{m.transferType || m.movementType}</Badge></td><td data-label="Amount" className={`md:text-right font-mono font-semibold ${m.movementType === 'CASH_IN' ? 'text-ok' : 'text-danger'}`}>{fmt(m.amount)}</td><td data-label="Account" className="font-mono text-xs">{m.destinationAccount || '-'}</td><td data-label="Ref" className="font-mono text-xs text-muted">{m.referenceNumber || '-'}</td><td data-label="Reason">{m.reason || '-'}</td><td data-label="Staff" className="text-xs text-muted">{m.userName || 'Staff'}</td></tr>))}</tbody></table></div>
        {!open && <button type="button" id="btnDslCorrectVariance" onClick={() => onCorrect(item)} className="btn btn-secondary"><i className="fa-solid fa-pen-to-square" />Correct counted cash</button>}
      </div>
    </Dialog>
  );
}

function TransferDialog({ shifts, preset, onClose, onDone }: { shifts: ShiftItem[]; preset: number | null; onClose: () => void; onDone: () => void }) {
  const open = shifts.find((i) => i.shift.status === 'OPEN');
  const [shiftId, setShiftId] = useState(String(preset ?? open?.shift.id ?? ''));
  const [type, setType] = useState('DRAWER_TO_BANK');
  const [amount, setAmount] = useState('');
  const [ref, setRef] = useState('');
  const [acct, setAcct] = useState('');
  const [reason, setReason] = useState('');
  const [by, setBy] = useState('');
  const save = useMutation({ mutationFn: (a: number) => recordTransfer(parseInt(shiftId, 10), { amount: a, transferType: type, destinationAccount: acct.trim(), referenceNumber: ref.trim(), reason: reason.trim(), approvedBy: by.trim() }), onSuccess: (_d, a) => { showToast(`Transfer ${type} of ₹${a.toFixed(2)} recorded successfully`, 'success'); onDone(); }, onError: (e: Error) => showToast(`Failed to record cash transfer: ${e.message}`, 'error') });
  const submit = (e: FormEvent) => { e.preventDefault(); const a = parseFloat(amount); const p = transferProblem(shiftId, a, reason); if (p) { showToast(p, 'warning'); return; } save.mutate(a); };
  return (
    <Dialog id="drawerTransferModal" open onClose={onClose} size="md" title="Record cash transfer" description="Move cash between the drawer till and a bank account or safe vault.">
      <form id="drawerTransferForm" onSubmit={submit} className="space-y-4">
        <Field id="dtShiftSelect" label="Target shift"><select id="dtShiftSelect" value={shiftId} onChange={(e) => setShiftId(e.target.value)} className="input"><option value="">Select shift…</option>{shifts.map((i) => <option key={i.shift.id} value={i.shift.id}>Shift #{i.shift.id} ({i.shift.status}) - {i.shift.cashierName} [{i.shift.registerId}]</option>)}</select></Field>
        <Field id="dtTypeSelect" label="Transfer type"><select id="dtTypeSelect" value={type} onChange={(e) => setType(e.target.value)} className="input">{TRANSFER_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
        <div className="grid grid-cols-2 gap-3"><Field id="dtAmountInput" label="Transfer amount (₹)"><input id="dtAmountInput" type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="input" placeholder="0.00" /></Field><Field id="dtRefInput" label="Reference / slip / UTR #"><input id="dtRefInput" value={ref} onChange={(e) => setRef(e.target.value)} className="input" placeholder="e.g. DEP-CHALLAN-2026-01" /></Field></div>
        <Field id="dtAccountInput" label="Destination account / safe name"><input id="dtAccountInput" value={acct} onChange={(e) => setAcct(e.target.value)} className="input" placeholder="e.g. HDFC Current A/c or Main Safe Locker" /></Field>
        <Field id="dtReasonInput" label="Reason / description"><input id="dtReasonInput" value={reason} onChange={(e) => setReason(e.target.value)} className="input" placeholder="Reason for cash relocation…" /></Field>
        <Field id="dtApprovedByInput" label="Approved by (optional)"><input id="dtApprovedByInput" value={by} onChange={(e) => setBy(e.target.value)} className="input" placeholder="Manager name" /></Field>
        <button type="submit" disabled={save.isPending} className="btn btn-primary w-full h-10">{save.isPending ? 'Recording…' : 'Record transfer'}</button>
      </form>
    </Dialog>
  );
}

function CorrectDialog({ item, onClose, onDone }: { item: ShiftItem; onClose: () => void; onDone: () => void }) {
  const sh = item.shift;
  const [count, setCount] = useState(effectiveCount(sh).toFixed(2));
  const [reason, setReason] = useState('');
  const save = useMutation({ mutationFn: (c: number) => correctVariance(sh.id, c, reason.trim()), onSuccess: (u) => { showToast(`Variance corrected for Shift #${sh.id}: Counted ₹${Number(u.correctedCountedCash).toFixed(2)}, Variance ₹${Number(u.correctedVariance).toFixed(2)}`, 'success'); onDone(); }, onError: (e: Error) => showToast(`Failed to apply variance correction: ${e.message}`, 'error') });
  const submit = (e: FormEvent) => { e.preventDefault(); const c = parseFloat(count); const p = correctionProblem(c, reason); if (p) { showToast(p, 'warning'); return; } save.mutate(c); };
  const v = effectiveVariance(sh);
  return (
    <Dialog id="correctVarianceModal" open onClose={onClose} size="sm" title="Correct shift cash count" description="An auditable correction of a closed shift's physical count. The original figures are kept.">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm rounded-lg bg-subtle p-3"><div><p className="text-xs text-muted">Original counted</p><p id="cvOriginalCounted" className="font-semibold text-fg">{fmt(effectiveCount(sh))}</p></div><div><p className="text-xs text-muted">Original variance</p><p id="cvOriginalVariance" className={`font-semibold ${v === 0 ? 'text-ok' : v > 0 ? 'text-warn' : 'text-danger'}`}>{signed(v)}</p></div></div>
        <Field id="cvNewCountInput" label="New verified cash count (₹)"><input id="cvNewCountInput" type="number" step="0.01" min="0" value={count} onChange={(e) => setCount(e.target.value)} className="input" placeholder="0.00" /></Field>
        <Field id="cvReasonInput" label="Audit correction reason (mandatory)"><textarea id="cvReasonInput" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className="input h-auto py-2" placeholder="e.g. Recount of safe envelope uncovered misplaced notes…" /></Field>
        <button type="submit" disabled={save.isPending} className="btn btn-primary w-full h-10">{save.isPending ? 'Saving…' : 'Apply correction'}</button>
      </form>
    </Dialog>
  );
}

function RulesDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const q = useQuery({ queryKey: ['shift-settings'], queryFn: fetchAnomalySettings, staleTime: 0 });
  if (q.isPending) return <Dialog id="shiftAnomalySettingsModal" open onClose={onClose} size="sm" title="Drawer anomaly rules"><Skeleton rows={3} /></Dialog>;
  if (q.isError) return <Dialog id="shiftAnomalySettingsModal" open onClose={onClose} size="sm" title="Drawer anomaly rules"><p className="text-sm text-danger">Failed to fetch anomaly settings: {q.error.message}</p></Dialog>;
  return <RulesForm s={q.data} onClose={onClose} onDone={onDone} />;
}
function RulesForm({ s, onClose, onDone }: { s: { varianceThreshold?: number; largeMovementThreshold?: number; flagMissingCount?: boolean; flagTransfersWithoutRef?: boolean }; onClose: () => void; onDone: () => void }) {
  const [variance, setVariance] = useState(Number(s.varianceThreshold || 500).toFixed(2));
  const [large, setLarge] = useState(Number(s.largeMovementThreshold || 5000).toFixed(2));
  const [missing, setMissing] = useState(s.flagMissingCount !== false);
  const [noRef, setNoRef] = useState(s.flagTransfersWithoutRef !== false);
  const save = useMutation({ mutationFn: () => saveAnomalySettings({ varianceThreshold: parseFloat(variance), largeMovementThreshold: parseFloat(large), flagMissingCount: missing, flagTransfersWithoutRef: noRef }), onSuccess: () => { showToast('Drawer anomaly rules updated successfully', 'success'); onDone(); }, onError: (e: Error) => showToast(`Failed to update anomaly settings: ${e.message}`, 'error') });
  return (
    <Dialog id="shiftAnomalySettingsModal" open onClose={onClose} size="sm" title="Drawer anomaly rules" description="Sensitivity thresholds for automatic shift flags.">
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(undefined); }} className="space-y-4">
        <Field id="asVarianceThreshold" label="Cash variance alert threshold (₹)" hint="Shifts with a shortage or surplus of at least this amount are flagged."><input id="asVarianceThreshold" type="number" step="0.01" min="0" value={variance} onChange={(e) => setVariance(e.target.value)} className="input" /></Field>
        <Field id="asLargeMovementThreshold" label="Large movement threshold (₹)" hint="Single cash in/out movements of at least this amount are flagged."><input id="asLargeMovementThreshold" type="number" step="0.01" min="0" value={large} onChange={(e) => setLarge(e.target.value)} className="input" /></Field>
        <label htmlFor="asFlagMissingCount" className="flex items-center gap-2 text-sm text-fg cursor-pointer"><input id="asFlagMissingCount" type="checkbox" checked={missing} onChange={(e) => setMissing(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--brand))]" />Flag shifts closed without a physical cash count</label>
        <label htmlFor="asFlagTransfersWithoutRef" className="flex items-center gap-2 text-sm text-fg cursor-pointer"><input id="asFlagTransfersWithoutRef" type="checkbox" checked={noRef} onChange={(e) => setNoRef(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--brand))]" />Flag bank / safe transfers without a reference number</label>
        <button type="submit" disabled={save.isPending} className="btn btn-primary w-full h-10">{save.isPending ? 'Saving…' : 'Save rules'}</button>
      </form>
    </Dialog>
  );
}
