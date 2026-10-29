/**
 * Sends one element to the browser's print dialog on an 80 mm-wide page (thermal paper), through a hidden iframe so
 * the rest of the screen is never printed. Waits for images (the logo) before printing.
 */
const STYLE = `
@page { size: 70mm auto; margin: 0; }
*, *::before, *::after { box-sizing: border-box !important; }
html, body { width: 70mm !important; max-width: 70mm !important; margin: 0 auto !important; padding: 2mm 3.5mm 2mm 1.5mm !important; background: #fff !important; color: #000 !important;
  font-family: 'Outfit', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif !important; font-size: 10.5px !important; font-weight: 600 !important; font-variant-numeric: tabular-nums;
  line-height: 1.25; -webkit-print-color-adjust: exact; print-color-adjust: exact; overflow-x: hidden !important; word-break: break-word; }
table { width: 100% !important; table-layout: fixed !important; border-collapse: collapse; }
th, td { padding: 2px 0; color: #000 !important; }
.receipt-divider { border-top: 1.5px dashed #000; margin: 5px 0; }
.kot-badge { display: inline-block; background: #000 !important; color: #fff !important; font-weight: 900 !important; font-size: 11px !important; padding: 1.5px 7px !important; border-radius: 4px !important; min-width: 24px !important; text-align: center !important; line-height: 1.3 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
.kot-table-banner { background: #000 !important; color: #fff !important; padding: 4px 6px !important; text-align: center !important; border-radius: 4px !important; margin: 4px 0 3px 0 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
.text-center { text-align: center; } .text-left { text-align: left; } .text-right { text-align: right; }
.bold { font-weight: 700 !important; } .black { font-weight: 900 !important; } .upper { text-transform: uppercase; }
.row { display: flex; justify-content: space-between; } .full { width: 100%; }
img.receipt-logo { max-width: 44mm; max-height: 16mm; object-fit: contain; display: block; margin: 0 auto; padding: 0; filter: grayscale(100%) contrast(200%); }
`;

export function printElementContent(elementId: string, title: string): void {
  const src = document.getElementById(elementId);
  if (!src) { window.print(); return; }
  document.getElementById('arviPrintIframe')?.remove();
  const iframe = document.createElement('iframe');
  iframe.id = 'arviPrintIframe';
  Object.assign(iframe.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow!.document;
  doc.open();
  doc.write(`<!DOCTYPE html><html><head><title>${title.replace(/[<>&]/g, '')}</title><style>${STYLE}</style></head><body>${src.innerHTML}</body></html>`);
  doc.close();
  const doPrint = () => { try { iframe.contentWindow!.focus(); iframe.contentWindow!.print(); } catch { window.print(); } };
  const imgs = [...doc.getElementsByTagName('img')];
  if (imgs.length === 0) { setTimeout(doPrint, 150); return; }
  let loaded = 0; let printed = false;
  const done = () => { loaded++; if (loaded >= imgs.length && !printed) { printed = true; setTimeout(doPrint, 100); } };
  imgs.forEach((i) => { if (i.complete) done(); else { i.onload = done; i.onerror = done; } });
  setTimeout(() => { if (!printed) { printed = true; doPrint(); } }, 600);   // a hanging image must not block printing
}
