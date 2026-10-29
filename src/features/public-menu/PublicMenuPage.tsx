import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router';
import { asset } from '../../lib/asset';
import { fetchPublicMenu, menuTarget, type PublicItem } from './api';

/** What customers see after scanning the table QR: the cafe's (or the branch's) menu. Read-only, no sign-in. */
export function PublicMenuPage() {
  const { cafe, branch } = menuTarget(useLocation().search);
  const menu = useQuery({
    queryKey: ['public-menu', cafe, branch],
    queryFn: ({ signal }) => fetchPublicMenu(cafe, branch, signal),
    enabled: cafe !== '', retry: false, staleTime: 30_000,
  });
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState<number | 'all'>('all');
  const symbol = menu.data?.currencySymbol || '₹';

  const categories = useMemo(() => menu.data?.categories ?? [], [menu.data]);
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return categories
      .filter((c) => cat === 'all' || c.id === cat)
      .map((c) => ({ ...c, items: c.items.filter((i) => !q || i.name.toLowerCase().includes(q) || (i.description ?? '').toLowerCase().includes(q)) }))
      .filter((c) => c.items.length > 0);
  }, [categories, cat, search]);

  if (cafe === '') return <Notice icon="fa-qrcode" title="Open the menu from your table's QR code" text="This link needs the cafe's name in it." />;
  if (menu.isPending) return <Notice icon="fa-mug-hot" title="Loading the menu…" />;
  if (menu.isError) return <Notice icon="fa-circle-info" title="Menu not available" text={menu.error.message} />;

  const m = menu.data;
  return (
    <main className="min-h-screen bg-canvas text-fg" data-testid="public-menu">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        <header className="text-center space-y-1.5">
          <img src={m.logoUrl || asset('logo-05.png')} alt={m.cafeName ?? 'Cafe'} className="w-16 h-16 mx-auto object-contain" />
          <h1 className="text-2xl font-semibold tracking-tight">{m.cafeName ?? cafe}</h1>
          {m.tagline && <p className="text-sm text-muted">{m.tagline}</p>}
          {(m.address || m.phone) && <p className="text-xs text-faint">{[m.address, m.phone].filter(Boolean).join(' · ')}</p>}
        </header>

        <input type="search" aria-label="Search the menu" className="input" placeholder="Search dishes" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1" role="tablist" aria-label="Categories">
          <Chip active={cat === 'all'} onClick={() => setCat('all')}>All</Chip>
          {categories.map((c) => <Chip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>{c.name}</Chip>)}
        </div>

        {shown.length === 0 && <p className="text-center text-sm text-muted py-8">Nothing matches your search.</p>}
        {shown.map((c) => (
          <section key={c.id} className="space-y-2" aria-label={c.name}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{c.name}</h2>
            <ul className="space-y-2">{c.items.map((i) => <Dish key={i.id} item={i} symbol={symbol} />)}</ul>
          </section>))}
      </div>
    </main>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" role="tab" aria-selected={active} onClick={onClick} className={`px-3.5 h-8 rounded-full text-sm whitespace-nowrap border ${active ? 'bg-brand/15 border-brand text-fg font-medium' : 'border-line text-muted'}`}>{children}</button>;
}

function Dish({ item, symbol }: { item: PublicItem; symbol: string }) {
  const soldOut = item.isAvailable === false;
  return (
    <li className={`card p-3 flex items-start justify-between gap-3 ${soldOut ? 'opacity-60' : ''}`}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span aria-label={item.isVeg ? 'Vegetarian' : 'Non-vegetarian'} className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center ${item.isVeg ? 'border-ok' : 'border-danger'}`}><span className={`w-1.5 h-1.5 rounded-full ${item.isVeg ? 'bg-ok' : 'bg-danger'}`} /></span>
          <span className="font-medium">{item.name}</span>
          {soldOut && <span className="text-[11px] text-danger font-medium">Sold out</span>}
        </div>
        {item.description && <p className="text-xs text-muted mt-1">{item.description}</p>}
      </div>
      <span className="font-mono font-semibold shrink-0">{symbol}{Number(item.price).toFixed(2)}</span>
    </li>
  );
}

function Notice({ icon, title, text }: { icon: string; title: string; text?: string }) {
  return (
    <main className="min-h-screen bg-canvas text-fg flex items-center justify-center p-6" data-testid="public-menu-notice">
      <div className="text-center max-w-sm space-y-2">
        <div className="w-12 h-12 mx-auto rounded-full bg-subtle text-faint flex items-center justify-center text-lg"><i className={`fa-solid ${icon}`} /></div>
        <p className="font-medium">{title}</p>
        {text && <p className="text-sm text-muted">{text}</p>}
      </div>
    </main>
  );
}
