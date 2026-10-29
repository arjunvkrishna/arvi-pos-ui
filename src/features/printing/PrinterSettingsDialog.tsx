import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUi } from '../../app/ui';
import { Dialog } from '../../components/Dialog';
import { showToast } from '../../components/toast';
import { Badge, Field, SegmentedTabs, Skeleton } from '../../components/ui';
import { PaymentQr } from './PaymentQr';
import { useSafeMutation as useMutation } from '../../lib/useSafeMutation';
import { fetchCategories, categoriesKey } from '../menu/api';
import { forgetConfiguredSsids, printerKey, printTestPage, savePrinterConfig, type PrinterConfig, type PrinterType } from './api';
import { usePrinterConfig, usePrinterHealth } from './hooks';
import { warnIfPrinterOffline } from './jobs';
import { ScanPanel } from './ScanPanel';
import { usePrinterScan } from './usePrinterScan';
import { brandName, cafeLogo, configFromForm, formFromConfig, hostFor, scanPort, uptimeText, type PrinterForm } from './rules';

type Tab = 'bill' | 'kot' | 'juice_kot' | 'network';
const TEST_LABEL: Record<PrinterType, string> = { BILL: 'Bill Counter Printer', KOT: 'KOT Kitchen Printer', JUICE_KOT: 'Juice KOT Printer' };

/** Opens from the header printer chip (and from a printer alert): status of all three printers, templates and layout, with a live preview. */
export function PrinterSettingsDialog() {
  const open = useUi((s) => s.printerSettingsOpen);
  const ui = useUi((s) => s.set);
  const cfg = usePrinterConfig();
  const close = () => ui({ printerSettingsOpen: false });
  if (!open) return null;
  return (
    <Dialog id="printerSettingsModal" open onClose={close} size="xl" title="WiFi thermal printer setup" description="ESC/POS 80 mm network printers · template studio and real-time preview">
      {cfg.isPending ? <Skeleton rows={5} /> : <Studio key={String(cfg.dataUpdatedAt)} cfg={cfg.data ?? null} />}
    </Dialog>
  );
}

function Studio({ cfg }: { cfg: PrinterConfig | null }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('bill');
  const [f, setF] = useState<PrinterForm>(() => formFromConfig(cfg));
  const set = (p: Partial<PrinterForm>) => setF((x) => ({ ...x, ...p }));
  const health = usePrinterHealth({ live: true });
  const cats = useQuery({ queryKey: categoriesKey, queryFn: fetchCategories });
  const scanState = usePrinterScan();
  const bridge = health.data?.bridge ?? null;
  const h = health.data?.health;
  const saved = cfg;

  const save = useMutation({
    mutationFn: () => savePrinterConfig(configFromForm(f)),
    onSuccess: (u) => { forgetConfiguredSsids(); qc.setQueryData([...printerKey, 'config'], u); showToast('Thermal printer settings saved successfully!', 'success'); void health.refetch().then((r) => { const hh = r.data?.health; if (hh) showToast(hh.allOnline ? 'All printers online & reachable!' : `${hh.offline.join(', ')} printer(s) offline`, hh.allOnline ? 'success' : 'warning'); }); },
    onError: (e: Error) => showToast(`Failed to save printer settings: ${e.message}`, 'error'),
  });
  const test = useMutation({
    mutationFn: (t: PrinterType) => { showToast(`Sending test slip to ${TEST_LABEL[t]}...`, 'info'); return printTestPage(t).then((r) => ({ r, t })); },
    onSuccess: ({ r, t }) => { if (r?.success) showToast(`Test slip printed successfully on ${TEST_LABEL[t]} (${r.host}:${r.port})!`, 'success'); else showToast(`Test print notice: ${r?.message}`, 'warning'); warnIfPrinterOffline(r); },
    onError: (e: Error) => showToast(`Failed to print test page: ${e.message}`, 'error'),
  });
  const ping = async () => { const r = await health.refetch(); const hh = r.data?.health; if (hh) showToast(hh.allOnline ? 'All printers online & reachable!' : `${hh.offline.join(', ')} printer(s) offline`, hh.allOnline ? 'success' : 'warning'); };
  const toggleCat = (id: string) => set({ juiceCategories: f.juiceCategories.includes(id) ? f.juiceCategories.filter((x) => x !== id) : [...f.juiceCategories, id] });

  const text = (id: string, key: keyof PrinterForm, label: string, ph = '', wide = false) => (
    <div className={wide ? 'sm:col-span-2' : ''}><Field id={id} label={label}><input id={id} value={String(f[key])} onChange={(e) => set({ [key]: e.target.value } as Partial<PrinterForm>)} className="input" placeholder={ph} /></Field></div>
  );
  const enabled = (id: string, key: 'billEnabled' | 'kotEnabled' | 'juiceKotEnabled', label: string) => (
    <label htmlFor={id} className="flex items-center gap-2 text-sm text-fg cursor-pointer"><input id={id} type="checkbox" checked={f[key]} onChange={(e) => set({ [key]: e.target.checked } as Partial<PrinterForm>)} className="h-4 w-4 accent-[rgb(var(--brand))]" />{label}</label>
  );
  const printerBox = (type: PrinterType, host: keyof PrinterForm, port: keyof PrinterForm, hostId: string, portId: string, toggleId: 'billEnabled' | 'kotEnabled' | 'juiceKotEnabled', enabledId: string, title: string, label: string, ph: string, testText: string) => (
    <div className="rounded-xl border border-line p-3 space-y-3">
      <div className="flex items-center justify-between gap-2"><p className="text-sm font-medium text-fg">{title}</p>{enabled(enabledId, toggleId, 'Enabled')}</div>
      <div className="grid grid-cols-3 gap-3"><div className="col-span-2">{text(hostId, host, label, ph)}</div>{text(portId, port, 'RAW port', '9100')}</div>
      <p className="hint">Standard ESC/POS port is 9100</p>
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={() => void scanState.start(type, scanPort(String(f[port])))} disabled={scanState.busy} title="Find this printer's IP by scanning the network" className="btn btn-secondary btn-sm"><i className="fa-solid fa-magnifying-glass-location" />Scan for IP</button>
        <button type="button" onClick={() => test.mutate(type)} disabled={test.isPending} className="btn btn-secondary btn-sm"><i className="fa-solid fa-vial" />{testText}</button>
      </div>
    </div>
  );
  const submit = (e: FormEvent) => { e.preventDefault(); save.mutate(undefined); };

  const mini = (type: PrinterType, idHost: string, idBadge: string, name: string) => {
    const on = h?.online[type];
    const lat = type === 'BILL' ? bridge?.billPrinterLatencyMs : type === 'KOT' ? bridge?.kotPrinterLatencyMs : bridge?.juiceKotPrinterLatencyMs;
    return (
      <div className="rounded-lg bg-subtle px-3 py-2 flex items-center justify-between gap-2 text-sm"><span className="min-w-0"><span className="text-muted">{name}:</span> <span id={idHost} className="font-mono text-xs text-fg">{hostFor(type, bridge, saved)}</span></span>
        <span id={idBadge} className={`text-xs font-semibold ${h ? (on ? 'text-ok' : 'text-danger') : 'text-muted'}`}>{!h ? 'Checking...' : on ? (h.bridgeOnline ? `ONLINE (${lat || 2}ms)` : 'ONLINE (LAN)') : 'OFFLINE'}</span></div>
    );
  };

  return (
    <div className="space-y-4">
      <div id="printerLiveStatusBox" className="card p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0"><span id="printerStatusIndicatorDot" className={`w-3 h-3 rounded-full shrink-0 ${!h ? 'bg-faint' : h.allOnline ? 'bg-ok animate-pulse' : 'bg-danger'}`} />
            <div className="min-w-0"><p className="flex flex-wrap items-center gap-2"><span id="printerStatusIndicatorText" className={`text-sm font-semibold ${!h ? 'text-muted' : h.allOnline ? 'text-ok' : 'text-danger'}`}>{!h ? 'Checking printer status...' : h.allOnline ? 'PRINTER SYSTEM ONLINE & READY' : 'PRINTER SYSTEM NOTICE / OFFLINE'}</span>
              <Badge tone={h?.bridgeOnline ? 'ok' : 'neutral'}><span id="printerBridgeBadge">{h?.bridgeOnline ? `ESP32 Bridge (${bridge?.bridgeIp || 'Online'})` : 'Direct LAN'}</span></Badge></p>
              <p id="printerStatusIndicatorSub" className="text-xs text-muted">{!h ? 'Connecting to printer...' : h.allOnline ? 'All printers (Bill, Kitchen KOT, Juice KOT) reachable & ready' : `${h.offline.join(', ')} printer(s) offline`}</p></div></div>
          <button type="button" id="btnPingPrinters" onClick={ping} disabled={health.isFetching} className="btn btn-secondary btn-sm"><i className={`fa-solid fa-tower-broadcast ${health.isFetching ? 'animate-pulse' : ''}`} />Ping test</button>
        </div>
        <div className="grid sm:grid-cols-3 gap-2">{mini('BILL', 'miniBillHostText', 'miniBillStatusBadge', 'Bill printer')}{mini('KOT', 'miniKotHostText', 'miniKotStatusBadge', 'Kitchen KOT')}{mini('JUICE_KOT', 'miniJuiceKotHostText', 'miniJuiceKotStatusBadge', 'Juice KOT')}</div>
      </div>

      <div className="grid lg:grid-cols-5 gap-5">
        <form id="printerSettingsForm" onSubmit={submit} className="lg:col-span-3 space-y-4 min-w-0">
          <SegmentedTabs label="Printer setup" value={tab} onChange={setTab} options={[{ value: 'bill', label: 'Bill', id: 'tabBtnPrinterBill' }, { value: 'kot', label: 'Kitchen KOT', id: 'tabBtnPrinterKot' }, { value: 'juice_kot', label: 'Juice KOT', id: 'tabBtnPrinterJuiceKot' }, { value: 'network', label: 'Network', id: 'tabBtnPrinterNetwork' }]} />

          {tab === 'bill' && (
            <div id="printerModuleBill" className="grid sm:grid-cols-2 gap-3">
              {text('cfgPrinterHeader', 'headerTitle', 'Header title (store / brand name)', brandName(), true)}
              {text('cfgPrinterSubheader', 'subheader', 'Subheader 1 (brand quote / tagline)', 'Where time tastes better', true)}
              {text('cfgPrinterSubheader2', 'subheader2', 'Subheader 2 (address / landmark / contact)', '', true)}
              {text('cfgPrinterFooter', 'footerMessage', 'Footer message', 'THANK YOU! VISIT AGAIN', true)}
              <label htmlFor="cfgPrinterLogoEnabled" className="flex items-center gap-2 text-sm text-fg cursor-pointer sm:col-span-2"><input id="cfgPrinterLogoEnabled" type="checkbox" checked={f.logoEnabled} onChange={(e) => set({ logoEnabled: e.target.checked })} className="h-4 w-4 accent-[rgb(var(--brand))]" />Print the logo on the bill</label>
              <label htmlFor="cfgPaymentQrEnabled" className="flex items-center justify-between gap-3 text-sm text-fg cursor-pointer sm:col-span-2 rounded-lg border border-line px-3 py-2.5">
                <span className="min-w-0"><span className="block font-medium">Payment QR on the bill</span><span className="block text-xs text-muted">UPI "Scan to pay" QR code between the payment mode and the thank-you line</span></span>
                <span className="relative inline-flex items-center shrink-0"><input id="cfgPaymentQrEnabled" type="checkbox" className="sr-only peer" checked={f.paymentQrEnabled} onChange={(e) => set({ paymentQrEnabled: e.target.checked })} />
                  <span className="w-9 h-5 rounded-full bg-line-strong peer-checked:bg-ok peer-focus-visible:ring-2 peer-focus-visible:ring-brand transition after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-4" /></span>
              </label>
              <Field id="cfgLogoSize" label={`Logo size: ${f.logoSize}px`}><input id="cfgLogoSize" type="range" min={24} max={72} step={4} value={f.logoSize} onChange={(e) => set({ logoSize: parseInt(e.target.value, 10) })} className="w-full h-7 accent-[rgb(var(--brand))]" /></Field>
              <Field id="cfgLogoGap" label={`Gap below logo: ${f.logoGap}px`}><input id="cfgLogoGap" type="range" min={0} max={12} step={1} value={f.logoGap} onChange={(e) => set({ logoGap: parseInt(e.target.value, 10) })} className="w-full h-7 accent-[rgb(var(--brand))]" /></Field>
              <Field id="cfgPrinterLineSpacing" label="Line spacing / density"><select id="cfgPrinterLineSpacing" value={f.lineSpacing} onChange={(e) => set({ lineSpacing: parseInt(e.target.value, 10) })} className="input"><option value={20}>Tight & compact (20 dots)</option><option value={24}>Standard crisp (24 dots – optimal)</option><option value={28}>Relaxed & spacious (28 dots)</option></select></Field>
              <Field id="cfgPrinterHeaderSize" label="Store name header font"><select id="cfgPrinterHeaderSize" value={f.fontSize} onChange={(e) => set({ fontSize: e.target.value })} className="input"><option value="DOUBLE_HEIGHT">Modern bold tall (high readability)</option><option value="DOUBLE_W_H">Large block (classic POS)</option></select></Field>
              <Field id="cfgPrinterPrintStyle" label="Thermal print contrast"><select id="cfgPrinterPrintStyle" value={f.printStyle} onChange={(e) => set({ printStyle: e.target.value })} className="input"><option value="CRISP_DARK">Deep black (double-strike – sharp)</option><option value="STANDARD">Standard thermal contrast</option></select></Field>
              <Field id="cfgPrinterFooterSpacing" label={`Footer margin before cut: ${f.footerSpacing} ${f.footerSpacing === 1 ? 'line' : 'lines'}`}><input id="cfgPrinterFooterSpacing" type="range" min={0} max={4} step={1} value={f.footerSpacing} onChange={(e) => set({ footerSpacing: parseInt(e.target.value, 10) })} className="w-full h-7 accent-[rgb(var(--brand))]" /></Field>
            </div>)}

          {tab === 'kot' && (
            <div id="printerModuleKot" className="grid gap-3">
              {text('cfgKotHeader', 'kotHeaderTitle', 'KOT header title', '*** KITCHEN ORDER ***')}
              {text('cfgKotSubheader', 'kotSubheader', 'KOT subheader / kitchen department', `${brandName()} - MAIN KITCHEN`)}
              {text('cfgKotFooter', 'kotFooterMessage', 'KOT footer message / audit notice', '--- END OF KOT ---')}
            </div>)}

          {tab === 'juice_kot' && (
            <div id="printerModuleJuiceKot" className="grid gap-3">
              {text('cfgJuiceKotHeader', 'juiceKotHeaderTitle', 'Juice KOT header title', '*** JUICE ORDER ***')}
              {text('cfgJuiceKotSubheader', 'juiceKotSubheader', 'Juice KOT subheader / beverage', `${brandName()} - JUICE BAR`)}
              {text('cfgJuiceKotFooter', 'juiceKotFooterMessage', 'Juice KOT footer message / audit notice', '--- END OF JUICE KOT ---')}
              <div className="rounded-lg border border-line p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-fg">Menu categories that print on the juice printer</p>
                  <span className="flex gap-1.5"><button type="button" id="btnJuiceSelectAll" onClick={() => set({ juiceCategories: (cats.data ?? []).map((c) => String(c.id)) })} className="btn btn-secondary btn-sm">Select all</button><button type="button" id="btnJuiceClear" onClick={() => set({ juiceCategories: [] })} className="btn btn-secondary btn-sm">Clear</button></span></div>
                <div id="juiceKotCategoriesList" className="grid grid-cols-2 sm:grid-cols-3 gap-2">{(cats.data ?? []).length === 0 ? <p className="text-xs text-muted italic col-span-full">No menu categories found.</p> : (cats.data ?? []).map((c) => (
                  <label key={c.id} className="flex items-center gap-2 p-2 rounded-lg border border-line hover:bg-subtle cursor-pointer text-sm"><input type="checkbox" name="juiceKotCategory" value={c.id} checked={f.juiceCategories.includes(String(c.id))} onChange={() => toggleCat(String(c.id))} className="h-4 w-4 accent-[rgb(var(--brand))]" /><span className="truncate" title={c.name}>{c.name}</span></label>))}</div>
                <p id="juiceKotCategorySelectedCount" className="text-xs text-muted">{f.juiceCategories.length} categor{f.juiceCategories.length === 1 ? 'y' : 'ies'} assigned</p>
              </div>
            </div>)}

          {tab === 'network' && (
            <div id="printerModuleNetwork" className="space-y-3">
              <ScanPanel state={scanState} port={scanPort(f.billPort)} hosts={{ BILL: f.billHost, KOT: f.kotHost, JUICE_KOT: f.juiceKotHost }}
                onUse={(type, ip, p) => set(type === 'BILL' ? { billHost: ip, billPort: String(p) } : type === 'KOT' ? { kotHost: ip, kotPort: String(p) } : { juiceKotHost: ip, juiceKotPort: String(p) })} />
              {printerBox('BILL', 'billHost', 'billPort', 'cfgBillPrinterHost', 'cfgBillPrinterPort', 'billEnabled', 'cfgBillPrinterEnabled', 'Bill (counter) printer', 'Bill printer IP address', '192.168.1.37', 'Test bill printer')}
              {printerBox('KOT', 'kotHost', 'kotPort', 'cfgKotPrinterHost', 'cfgKotPrinterPort', 'kotEnabled', 'cfgKotPrinterEnabled', 'Kitchen KOT printer', 'KOT printer IP address', '192.168.1.47', 'Test KOT printer')}
              {printerBox('JUICE_KOT', 'juiceKotHost', 'juiceKotPort', 'cfgJuiceKotPrinterHost', 'cfgJuiceKotPrinterPort', 'juiceKotEnabled', 'cfgJuiceKotPrinterEnabled', 'Juice bar KOT printer', 'Juice KOT printer IP', '192.168.1.42', 'Test juice KOT')}
              <div className="rounded-lg border border-line p-3 space-y-2"><div className="flex items-center justify-between"><p className="text-sm font-medium text-fg"><i className="fa-solid fa-microchip mr-1.5 text-faint" />Dedicated ESP32 hardware bridge</p>
                <Badge tone={bridge?.bridgeOnline ? 'ok' : 'neutral'}><span id="esp32BridgeLiveStatusPill">{bridge?.bridgeOnline ? 'ONLINE (Ready)' : 'OFFLINE (Direct LAN)'}</span></Badge></div>
                <p className="hint">ESP32-S3-N16R8 (16 MB flash + 8 MB PSRAM)</p>
                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm"><div><dt className="text-xs text-muted">Bridge IP</dt><dd id="esp32BridgeIpVal" className="font-mono text-fg">{bridge?.bridgeOnline ? bridge.bridgeIp || '192.168.1.x' : 'Local Server'}</dd></div>
                  <div><dt className="text-xs text-muted">PSRAM free</dt><dd id="esp32PsramVal" className="font-mono text-fg">{bridge?.bridgeOnline ? `${bridge.freePsramBytes ? (bridge.freePsramBytes / (1024 * 1024)).toFixed(1) : '7.9'} MB / 8 MB` : '8 MB PSRAM (N16R8)'}</dd></div>
                  <div><dt className="text-xs text-muted">Queue</dt><dd id="esp32QueueVal" className="font-mono text-fg">{bridge?.bridgeOnline ? bridge.pendingJobs || 0 : 0} pending</dd></div>
                  <div><dt className="text-xs text-muted">Uptime</dt><dd id="esp32UptimeVal" className="font-mono text-fg">{bridge?.bridgeOnline ? uptimeText(bridge.uptimeSeconds) : '--'}</dd></div></dl></div>
              <label htmlFor="cfgPrinterAutoCut" className="flex items-start gap-2 text-sm text-fg cursor-pointer"><input id="cfgPrinterAutoCut" type="checkbox" checked={f.autoCut} onChange={(e) => set({ autoCut: e.target.checked })} className="mt-0.5 h-4 w-4 accent-[rgb(var(--brand))]" /><span>Auto paper cut<span className="block text-xs text-muted">Trigger the automatic knife cut after printing a receipt or KOT.</span></span></label>
            </div>)}

          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" onClick={() => test.mutate('BILL')} disabled={test.isPending} className="btn btn-secondary"><i className="fa-solid fa-vial" />Test bill printer</button>
            <button type="button" onClick={() => test.mutate('KOT')} disabled={test.isPending} className="btn btn-secondary"><i className="fa-solid fa-vial" />Test KOT printer</button>
            <button type="button" onClick={() => test.mutate('JUICE_KOT')} disabled={test.isPending} className="btn btn-secondary"><i className="fa-solid fa-vial" />Test juice KOT</button>
            <button type="submit" id="btnSavePrinterSettings" disabled={save.isPending} className="btn btn-primary ml-auto"><i className="fa-solid fa-floppy-disk" />{save.isPending ? 'Saving…' : 'Save settings'}</button>
          </div>
        </form>

        <aside className="lg:col-span-2"><Preview f={f} tab={tab} /></aside>
      </div>
    </div>
  );
}

/** What the paper will look like, updated as you type (80 mm replica). */
function Preview({ f, tab }: { f: PrinterForm; tab: Tab }) {
  const [view, setView] = useState<'bill' | 'kot' | 'juice_kot'>('bill');
  const shown = tab === 'network' ? view : tab;
  const line = f.lineSpacing <= 20 ? 1.1 : f.lineSpacing <= 24 ? 1.25 : 1.45;
  const paper: React.CSSProperties = { background: '#fff', color: '#000', border: '1px dashed #9ca3af', borderRadius: 6, padding: 12, fontFamily: 'monospace', fontSize: 11, lineHeight: line, textAlign: 'center' };
  const kotLike = (id: string, header: string, sub: string, footer: string, h: string, s: string, ft: string) => (
    <div id={id} style={paper}><div id={h} style={{ fontWeight: 900, fontSize: 13 }}>{header}</div>{sub && <div id={s}>{sub}</div>}<div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
      <div style={{ textAlign: 'left' }}>TABLE: T1<br />2 × Masala Tea<br />1 × Veg Sandwich</div><div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} /><div id={ft} style={{ fontWeight: 800, paddingBottom: f.footerSpacing * 4 }}>{footer}</div></div>);
  return (
    <div className="card p-4 lg:sticky lg:top-2 space-y-3">
      <div className="flex items-center justify-between gap-2"><div><h4 className="text-sm font-medium text-fg"><i className="fa-solid fa-receipt mr-1.5 text-faint" />Live print preview</h4><p className="text-xs text-muted">80 mm ESC/POS thermal replica</p></div>
        <span className="flex gap-1">{(['bill', 'kot', 'juice_kot'] as const).map((v) => <button key={v} type="button" id={`livePreviewBtn${v === 'bill' ? 'Bill' : v === 'kot' ? 'Kot' : 'JuiceKot'}`} onClick={() => setView(v)} className={`btn btn-sm ${shown === v ? 'btn-primary' : 'btn-secondary'}`}>{v === 'bill' ? 'Bill' : v === 'kot' ? 'KOT' : 'Juice'}</button>)}</span></div>
      {shown === 'bill' && (
        <div id="liveBillPreviewContainer" style={paper}>
          {f.logoEnabled && <img id="livePreviewLogo" src={cafeLogo()} alt="" style={{ maxHeight: f.logoSize, marginBottom: f.logoGap, display: 'block', margin: `0 auto ${f.logoGap}px` }} />}
          <div id="livePreviewHeader" style={{ fontWeight: 900, fontSize: f.fontSize === 'DOUBLE_W_H' ? 20 : 16, textTransform: 'uppercase' }}>{f.headerTitle || brandName()}</div>
          {f.subheader && <div id="livePreviewSubheader1">{f.subheader}</div>}{f.subheader2 && <div id="livePreviewSubheader2" style={{ fontSize: 10 }}>{f.subheader2}</div>}
          <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} /><div style={{ textAlign: 'left' }}>Bill: NRM-0001<br />2 × Masala Tea  ₹40.00<br />1 × Veg Sandwich  ₹80.00</div>
          <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} /><div style={{ fontWeight: 900 }}>TOTAL ₹126.00</div>
          <div style={{ textAlign: 'left' }}>Payment Mode: CASH</div>
          {f.paymentQrEnabled && <PaymentQr small />}
          <div id="livePreviewFooter" style={{ fontWeight: 800, paddingBottom: f.footerSpacing * 4, marginTop: 6 }}>{f.footerMessage || 'THANK YOU! VISIT AGAIN'}</div>
        </div>)}
      {shown === 'kot' && <div id="liveKotPreviewContainer">{kotLike('liveKotPreview', f.kotHeaderTitle, f.kotSubheader, f.kotFooterMessage, 'liveKotPreviewHeader', 'liveKotPreviewSubheader', 'liveKotPreviewFooter')}</div>}
      {shown === 'juice_kot' && <div id="liveJuiceKotPreviewContainer">{kotLike('liveJuiceKotPreview', f.juiceKotHeaderTitle, f.juiceKotSubheader, f.juiceKotFooterMessage, 'liveJuiceKotPreviewHeader', 'liveJuiceKotPreviewSubheader', 'liveJuiceKotPreviewFooter')}</div>}
    </div>
  );
}
