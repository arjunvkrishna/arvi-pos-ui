import { showToast } from '../../components/toast';
import type { PrinterType } from './api';
import { SCAN_SLOTS, scanProgress, scanTone, slotsUsing } from './rules';
import type { PrinterScanState } from './usePrinterScan';

/** The "Find printers on the network" panel: status, progress and the printers found, each assignable to Bill / KOT / Juice KOT. */
export function ScanPanel({ state, hosts, port, onUse }: { state: PrinterScanState; hosts: Record<PrinterType, string>; port: number; onUse: (type: PrinterType, ip: string, port: number) => void }) {
  const { scan, target, busy, starting, error } = state;
  const list = scan?.printers ?? [];
  const tone = error ? 'danger' : scan ? scanTone(scan.status) : 'info';
  const toneClass = tone === 'danger' ? 'text-danger' : tone === 'ok' ? 'text-ok' : 'text-info';
  const where = scan?.subnet && (scan.status === 'DONE' || scan.status === 'RUNNING') ? ` (${scan.subnet}, port ${scan.port})` : '';
  const text = error || (starting ? 'Asking the print bridge to scan the network...' : scan ? `${scan.message || ''}${where}` : '');
  const pick = (type: PrinterType, ip: string, p: number) => {
    onUse(type, ip, p);
    state.setTarget(type);
    const label = SCAN_SLOTS.find((s) => s.type === type)!.label;
    showToast(`${label} set to ${ip}:${p}. Press Save Changes to apply.`, 'success');
  };
  return (
    <div id="printerScanPanel" className="rounded-xl border border-info/30 bg-info/5 p-3.5 space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-7 h-7 rounded-lg bg-info/15 text-info flex items-center justify-center text-xs shrink-0"><i className="fa-solid fa-magnifying-glass-location" /></span>
          <div className="min-w-0"><p className="text-sm font-medium text-fg">Find printers on the network</p><p className="text-xs text-muted">If a printer's IP changed, scan to find its new address (port {port})</p></div>
        </div>
        <button type="button" id="btnScanPrinters" disabled={busy} onClick={() => void state.start(null, port)} className="btn btn-secondary btn-sm"><i className="fa-solid fa-satellite-dish" /><span id="btnScanPrintersText">{busy ? 'Scanning...' : 'Scan network'}</span></button>
      </div>
      {text && <p id="printerScanStatus" role="status" className={`text-xs ${toneClass}`}>{text}</p>}
      {scan?.status === 'RUNNING' && (scan.total ?? 0) > 0 && <div id="printerScanProgressWrap" className="h-1.5 rounded-full bg-subtle overflow-hidden"><div id="printerScanProgress" className="h-full bg-info transition-all" style={{ width: `${scanProgress(scan.scanned, scan.total)}%` }} /></div>}
      {list.length > 0 && (
        <div id="printerScanResults" className="space-y-1.5">
          {list.map((p) => {
            const inUse = slotsUsing(p.ip, hosts);
            return (
              <div key={`${p.ip}:${p.port}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface p-2">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <i className="fa-solid fa-print text-info text-xs" />
                  <span className="font-mono text-xs font-semibold text-fg">{p.ip}:{p.port}</span>
                  {inUse.length ? <span className="badge badge-ok">Current: {inUse.join(' + ')}</span> : <span className="badge badge-warn">New address</span>}
                  {p.busy ? <span className="text-[10px] text-muted">printing now</span> : p.latencyMs != null ? <span className="text-[10px] text-muted">{p.latencyMs} ms</span> : null}
                </div>
                <div className="flex items-center gap-1"><span className="text-[10px] text-muted mr-0.5">Use for</span>
                  {SCAN_SLOTS.map((s) => (
                    <button key={s.type} type="button" data-scan-ip={p.ip} data-scan-port={p.port} data-scan-for={s.type} onClick={() => pick(s.type, p.ip, p.port)}
                      className={`px-2 py-1 rounded-md text-[11px] font-bold border transition ${target === s.type ? 'bg-cyan-500 text-gray-950 border-cyan-400 hover:bg-cyan-400' : 'bg-subtle text-fg border-line hover:bg-line'}`}>{s.short}</button>))}
                </div>
              </div>);
          })}
          {scan?.status === 'DONE' && <p className="text-[11px] text-muted">Picking an address fills the IP field. Press Save settings to apply it.</p>}
        </div>
      )}
    </div>
  );
}
