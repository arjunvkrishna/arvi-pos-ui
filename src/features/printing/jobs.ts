import { showToast } from '../../components/toast';
import { jobStatus, type PrintResponse } from './api';

/** The server queues a ticket even when the printer or bridge is offline; tell the operator it will wait. */
export const warnIfPrinterOffline = (res?: PrintResponse | null) => { if (res?.warning) showToast(res.warning, 'warning'); };

/** Follows one print job: a quick check, a second one, then every 1.2 s up to 10 times; reports done / needs review / failed. */
export function trackPrintJob(jobId: string | undefined, initial: string | undefined, label = 'Print job') {
  if (!jobId) return;
  if (initial === 'COMPLETED') { showToast(`${label} printed successfully!`, 'success'); return; }
  showToast(`${label} queued for printing (${jobId.slice(0, 8)})...`, 'info');
  let attempts = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  const check = async (): Promise<boolean> => {
    attempts++;
    try {
      const r = await jobStatus(jobId);
      if (!r) return false;
      if (r.status === 'COMPLETED') { showToast(`${label} printed successfully!`, 'success'); return true; }
      if (r.status === 'NEEDS_REVIEW') { showToast(`${label} needs review (printer issue or uncertain delivery)`, 'warning'); return true; }
      if (r.status === 'FAILED') { showToast(`${label} failed: ${r.lastErrorMessage || 'Check printer connection'}`, 'error'); return true; }
      return attempts >= 10;           // still queued: the print queue will deliver it
    } catch { return attempts >= 10; }
  };
  setTimeout(async () => {
    if (await check()) return;
    setTimeout(async () => {
      if (await check()) return;
      timer = setInterval(async () => { if (await check() && timer) clearInterval(timer); }, 1200);
    }, 400);
  }, 350);
}
