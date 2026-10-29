import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchPrinterScan, startPrinterScanRequest, type PrinterScan, type PrinterType } from './api';
import { scanRunning } from './rules';

const MAX_SCAN_MS = 4 * 60 * 1000;

/** Runs one "find printers" scan at a time: start it, follow it every 1.2 s, stop when it ends or the dialog closes. */
export function usePrinterScan() {
  const [scan, setScan] = useState<PrinterScan | null>(null);
  const [target, setTarget] = useState<PrinterType | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const run = useRef(0);                                        // a newer scan makes older polls give up

  const stop = useCallback(() => { run.current++; if (timer.current) { clearTimeout(timer.current); timer.current = null; } }, []);
  useEffect(() => stop, [stop]);

  const start = useCallback(async (forType: PrinterType | null, port: number) => {
    stop();
    const mine = run.current;
    const begun = Date.now();
    setTarget(forType); setScan(null); setError(''); setStarting(true);
    try {
      let current = await startPrinterScanRequest(port);
      if (run.current !== mine) return;
      setScan(current); setStarting(false);
      const poll = () => {
        timer.current = setTimeout(async () => {
          if (run.current !== mine) return;
          try {
            current = await fetchPrinterScan(current.id);
            if (run.current !== mine) return;
            setScan(current);
            if (scanRunning(current.status) && Date.now() - begun < MAX_SCAN_MS) poll();
          } catch (e) { if (run.current === mine) setError(`Lost contact while scanning: ${e instanceof Error ? e.message : e}`); }
        }, 1200);
      };
      if (scanRunning(current.status)) poll();
    } catch (e) {
      if (run.current === mine) { setStarting(false); setError(e instanceof Error ? e.message || 'Could not start the scan.' : 'Could not start the scan.'); }
    }
  }, [stop]);

  const busy = starting || scanRunning(scan?.status);
  return { scan, target, setTarget, busy, starting, error, start };
}
export type PrinterScanState = ReturnType<typeof usePrinterScan>;
