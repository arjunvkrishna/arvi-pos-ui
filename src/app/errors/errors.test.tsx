import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CrashBoundary } from './ErrorPages';
import copy from './errorCopy.json';

const pub = join(__dirname, '../../../public/errors');
const nginx = readFileSync(join(__dirname, '../../../nginx.conf'), 'utf8');
const statusPages = Object.keys(copy).filter((k) => /^\d{3}$/.test(k));

describe('error pages served by nginx', () => {
  it('every status nginx handles has a page, and every page is used', () => {
    const mapped = [...nginx.matchAll(/^\s*error_page\s+(\d{3})\s+\/errors\/\1\.html;/gm)].map((m) => m[1]).sort();
    expect(mapped).toEqual([...statusPages].sort());
    for (const code of statusPages) expect(existsSync(join(pub, `${code}.html`)), code).toBe(true);
  });
  it('each page carries its own wording and marker, runs no script, and uses only files from this site', () => {
    for (const code of statusPages) {
      const html = readFileSync(join(pub, `${code}.html`), 'utf8');
      const c = (copy as Record<string, { title: string; mood: string; retry?: boolean }>)[code];
      expect(html, code).toContain(`data-error-page="${code}"`);
      expect(html, code).toContain(c.title.replace(/&/g, '&amp;'));
      expect(html, code).not.toMatch(/<script/i);
      expect(html, code).not.toMatch(/https?:\/\//i);
      expect(existsSync(join(pub, `cup-${c.mood}.svg`)), code).toBe(true);
      expect(html.includes('http-equiv="refresh"'), `${code} retry`).toBe(Boolean(c.retry));
    }
  });
  it('the pages that mean "the server is not ready" retry by themselves, the others never do', () => {
    expect(statusPages.filter((c) => (copy as Record<string, { retry?: boolean }>)[c].retry).sort()).toEqual(['502', '503', '504']);
  });
  it('the drawings are plain files with no script', () => {
    for (const f of readdirSync(pub).filter((x) => x.endsWith('.svg'))) expect(readFileSync(join(pub, f), 'utf8'), f).not.toMatch(/<script|onload=/i);
  });
  it('the API answers nginx makes itself are JSON, not pages', () => {
    for (const name of ['api_unavailable', 'api_busy', 'api_forbidden']) {
      const block = nginx.match(new RegExp(`location @${name} \\{[^}]*\\}`))?.[0] ?? '';
      expect(block, name).toContain('default_type application/json');
      expect(block, name).toMatch(/return \d{3} '\{"error":/);
    }
    expect(nginx).toMatch(/location \/api\/ \{\s*error_page 502 503 504 = @api_unavailable;/);
    expect(nginx).toMatch(/location = \/api\/auth\/login \{[^}]*error_page 429 = @api_busy;/s);
  });
});

describe('a crashed screen', () => {
  it('shows the friendly page with a reload button instead of a blank screen', () => {
    const Boom = () => { throw new Error('boom'); };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<CrashBoundary><Boom /></CrashBoundary>);
    expect(screen.getByText('Oops, something spilled')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    spy.mockRestore();
  });
  it('shows the screen when nothing goes wrong', () => {
    render(<CrashBoundary><p>all fine</p></CrashBoundary>);
    expect(screen.getByText('all fine')).toBeInTheDocument();
  });
});
