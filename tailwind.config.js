const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

/** Semantic colours: every screen uses these names, so light / dark (and later per-tenant branding) is one set of CSS variables. */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  safelist: [{ pattern: /^badge-(neutral|brand|ok|danger|warn|info)$/ }],   // built from a prop (badge-${tone}), so the scanner cannot see them
  theme: {
    extend: {
      colors: {
        canvas: token('canvas'), surface: token('surface'), subtle: token('subtle'),
        line: token('line'), 'line-strong': token('line-strong'),
        fg: token('fg'), muted: token('muted'), faint: token('faint'),
        brand: token('brand'), 'brand-text': token('brand-text'),
        ok: token('ok'), danger: token('danger'), warn: token('warn'), info: token('info'),
      },
      fontFamily: { sans: ['Outfit', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      boxShadow: { card: '0 1px 2px rgb(0 0 0 / 0.04)', pop: '0 12px 32px -8px rgb(0 0 0 / 0.25)' },
    },
  },
  plugins: [],
};
