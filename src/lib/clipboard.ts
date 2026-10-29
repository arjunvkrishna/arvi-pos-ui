import { showToast } from '../components/toast';

export async function copyText(text: string | null | undefined, label: string) {
  if (!text) { showToast(`No ${label} to copy`, 'warning'); return; }
  try { await navigator.clipboard.writeText(text); showToast(`${label} copied to clipboard!`, 'success'); }
  catch { window.prompt(`Copy ${label}:`, text); }
}
