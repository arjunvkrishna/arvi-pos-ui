import { describe, expect, it } from 'vitest';
import { linkInstructions, sanitizeReport } from './rules';

describe('Telegram report preview', () => {
  it('keeps the formatting Telegram supports', () => {
    expect(sanitizeReport('<b>Low stock</b>\n<i>3</i> items<br>x')).toBe('<b>Low stock</b>\n<i>3</i> items<br>x');
  });
  it('removes scripts, event handlers and links but keeps their text', () => {
    const out = sanitizeReport('<b onclick="x()">hi</b><script>alert(1)</script><img src=x onerror="alert(2)"><a href="javascript:alert(3)">go</a>');
    expect(out).toBe('<b>hi</b>alert(1)go');
    expect(out).not.toMatch(/onclick|onerror|<script|href/);
  });
  it('writes the linking instructions', () => {
    expect(linkInstructions('arvi_bot', 'ABC123')).toContain('/link ABC123');
    expect(linkInstructions(null, 'ABC123')).toContain('search for the bot');
  });
});
