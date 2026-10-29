import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useWide } from './useWide';

export interface FlowEdge { id: string; node: ReactNode; label: string; selected?: boolean; warn?: boolean; onSelect: () => void }
interface Path { id: string; d: string; mx: number; my: number }

/**
 * A small flow diagram around one thing: the focus card on one side, everything connected to it on the other, joined by curved
 * connectors that carry the quantity. 'out' = the focus uses the others (dish -> stock items); 'in' = the others use the focus
 * (stock item <- dishes). Sideways from tablet width; a plain vertical chain on a phone.
 */
export function FlowDiagram({ focus, edges, flow, add }: { focus: ReactNode; edges: FlowEdge[]; flow: 'out' | 'in'; add?: ReactNode }) {
  const wide = useWide();
  const box = useRef<HTMLDivElement>(null);
  const focusBox = useRef<HTMLDivElement>(null);
  const kids = useRef(new Map<string, HTMLDivElement>());
  const [paths, setPaths] = useState<{ w: number; h: number; list: Path[] }>({ w: 0, h: 0, list: [] });
  const key = edges.map((e) => e.id).join(',');

  useEffect(() => {
    if (!wide) return;
    const measure = () => {
      const c = box.current; const f = focusBox.current;
      if (!c || !f) return;
      const cr = c.getBoundingClientRect(); const fr = f.getBoundingClientRect();
      const list: Path[] = [];
      for (const id of key ? key.split(',') : []) {
        const el = kids.current.get(id);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        const x1 = (flow === 'out' ? fr.right : fr.left) - cr.left; const y1 = fr.top + fr.height / 2 - cr.top;
        const x2 = (flow === 'out' ? r.left : r.right) - cr.left; const y2 = r.top + r.height / 2 - cr.top;
        const dx = Math.max(24, Math.abs(x2 - x1) / 2) * (flow === 'out' ? 1 : -1);
        list.push({ id, d: `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`, mx: (x1 + x2) / 2, my: (y1 + y2) / 2 });
      }
      setPaths({ w: cr.width, h: cr.height, list });
    };
    const ro = new ResizeObserver(measure);
    if (box.current) ro.observe(box.current);
    const raf = requestAnimationFrame(measure);
    return () => { ro.disconnect(); cancelAnimationFrame(raf); };
  }, [wide, key, flow]);

  const selectedId = edges.find((e) => e.selected)?.id;
  const kid = (e: FlowEdge) => (
    <div key={e.id} ref={(el) => { if (el) kids.current.set(e.id, el); else kids.current.delete(e.id); }} data-flow-node={e.id}>{e.node}</div>
  );

  if (!wide) {
    return (
      <div className="space-y-2" data-flow={flow} data-layout="stack">
        {focus}
        <div className="ml-5 pl-4 border-l-2 border-line-strong space-y-3">
          <p className="text-xs font-medium text-muted -ml-1">{flow === 'out' ? 'Takes from stock' : 'Used by dishes'}</p>
          {edges.map((e) => (
            <div key={e.id} className="space-y-1.5 relative">
              <button type="button" onClick={e.onSelect} data-edge={e.id} aria-pressed={e.selected} className={`chip-edge ${e.selected ? 'chip-edge-on' : ''}`}>{e.warn && <i className="fa-solid fa-triangle-exclamation text-warn" />}{e.label}</button>
              {e.node}
            </div>
          ))}
          {edges.length === 0 && <p className="text-sm text-muted">Nothing linked yet.</p>}
          {add}
        </div>
      </div>
    );
  }

  const focusCol = <div ref={focusBox} className="self-center" data-flow-focus>{focus}</div>;
  const kidsCol = (
    <div className="space-y-3 min-w-0">
      {edges.map(kid)}
      {edges.length === 0 && <p className="text-sm text-muted px-1">Nothing linked yet.</p>}
      {add}
    </div>
  );
  return (
    <div ref={box} className="relative grid grid-cols-[minmax(0,18rem)_minmax(3.5rem,1fr)_minmax(0,18rem)] items-stretch" data-flow={flow} data-layout="side">
      {flow === 'out' ? focusCol : kidsCol}
      <div aria-hidden="true" />
      {flow === 'out' ? kidsCol : focusCol}
      <svg className="absolute inset-0 pointer-events-none overflow-visible" width={paths.w} height={paths.h} aria-hidden="true">
        {paths.list.map((p) => <path key={p.id} d={p.d} fill="none" strokeWidth={p.id === selectedId ? 2.5 : 1.75} className={p.id === selectedId ? 'stroke-[rgb(var(--brand))]' : 'stroke-[rgb(var(--line-strong))]'} />)}
      </svg>
      {paths.list.map((p) => {
        const e = edges.find((x) => x.id === p.id);
        if (!e) return null;
        return (
          <button key={p.id} type="button" onClick={e.onSelect} data-edge={e.id} aria-pressed={e.selected} title="Edit this link"
            style={{ left: p.mx, top: p.my }} className={`chip-edge absolute -translate-x-1/2 -translate-y-1/2 ${e.selected ? 'chip-edge-on' : ''}`}>
            {e.warn && <i className="fa-solid fa-triangle-exclamation text-warn" />}{e.label}
          </button>
        );
      })}
    </div>
  );
}
