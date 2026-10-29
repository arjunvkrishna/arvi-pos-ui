/**
 * The low-stock report is Telegram-flavoured HTML from the server. Only the tags Telegram itself supports are kept
 * (and none of their attributes); everything else is shown as plain text, so the preview can never run script.
 */
const ALLOWED = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'CODE', 'PRE', 'BR']);

export function sanitizeReport(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return esc(node.textContent ?? '');
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const el = node as Element;
    const inner = [...el.childNodes].map(walk).join('');
    if (el.tagName === 'BR') return '<br>';
    return ALLOWED.has(el.tagName) ? `<${el.tagName.toLowerCase()}>${inner}</${el.tagName.toLowerCase()}>` : inner;
  };
  return [...doc.body.childNodes].map(walk).join('');
}

export const linkInstructions = (botUsername: string | null | undefined, code: string) =>
  `ARVI POS Telegram Verification:\n1. Open Telegram and search for ${botUsername ? `@${botUsername}` : 'the bot'}\n2. Send command: /link ${code}\n(Code valid for 15 minutes)`;
