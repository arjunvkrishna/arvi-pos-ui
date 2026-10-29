import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '../../api/session';
import { Dialog } from '../../components/Dialog';
import { showToast } from '../../components/toast';
import { Badge, EmptyState, Field, PageHeader, Skeleton } from '../../components/ui';
import { copyText } from '../../lib/clipboard';
import { useSafeMutation as useMutation } from '../../lib/useSafeMutation';
import { cafesKey, changePlatformPassword, createCafe, fetchCafes, fetchStats, revealBridgeToken, rotateBridgeToken, statsKey, updateCafe, type Cafe, type NewCafe } from './api';
import { limitText } from '../../api/roles';
import type { PlanName } from '../../api/types';
import { CAFE_CODE, MODULES, passwordProblem, PLAN_LIMITS, PLANS, planIncludes, planLimitsText, suggestCode } from './rules';

const inr = (n?: number) => `₹${(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

/** The SaaS owner's screen: every cafe on the platform, their plans and limits, and the print-bridge token each cafe needs. */
export function PlatformPage() {
  const user = useSession((s) => s.user)!;
  const qc = useQueryClient();
  const cafes = useQuery({ queryKey: cafesKey, queryFn: fetchCafes });
  const stats = useQuery({ queryKey: statsKey, queryFn: fetchStats });
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Cafe | null>(null);
  const [bridge, setBridge] = useState<Cafe | null>(null);
  const refresh = () => { void qc.invalidateQueries({ queryKey: cafesKey }); void qc.invalidateQueries({ queryKey: statsKey }); };
  const toggle = useMutation({
    mutationFn: (c: Cafe) => updateCafe(c.id, { status: c.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' }),
    onSuccess: () => { showToast('Cafe status changed.', 'success'); refresh(); },
    onError: (e: Error) => showToast(e.message, 'error'),
  });

  return (
    <section id="tab-cafes" data-testid="tab-cafes" className="space-y-5">
      <PageHeader title="Cafes on the platform" description="Every cafe has its own database. Suspending a cafe stops its staff signing in; nothing is deleted."
        actions={<button type="button" id="btnAddCafe" className="btn btn-primary" onClick={() => setCreating(true)}><i className="fa-solid fa-plus" />New cafe</button>} />
      {user.mustChangePassword && <div role="alert" className="text-sm bg-warn/15 text-fg rounded-lg px-3 py-2"><i className="fa-solid fa-triangle-exclamation text-warn mr-1.5" />You are using the first-time password. Please set your own below.</div>}

      {stats.data && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Stat label="Cafes" value={`${stats.data.activeCafes} / ${stats.data.totalCafes} active`} />
          <Stat label="Branches" value={String(stats.data.totalOutlets)} />
          <Stat label="People" value={String(stats.data.totalUsers)} />
          <Stat label="Paid orders" value={String(stats.data.totalOrders)} />
          <Stat label="Sales" value={inr(stats.data.totalGmv)} />
        </div>)}

      {cafes.isPending && <div className="card"><Skeleton rows={4} /></div>}
      {cafes.isError && <div role="alert" className="text-sm text-danger bg-danger/10 rounded-lg px-3 py-2">Could not load the cafes: {cafes.error.message}</div>}
      {cafes.isSuccess && cafes.data.length === 0 && <div className="card"><EmptyState icon="fa-building" title="No cafes yet" hint="Create the first one." /></div>}
      {cafes.isSuccess && cafes.data.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm" data-testid="cafes-table">
            <thead><tr className="text-left text-xs text-muted border-b border-line"><th className="p-3">Cafe</th><th className="p-3">Plan</th><th className="p-3">Branches</th><th className="p-3">People</th><th className="p-3">Sales</th><th className="p-3">Status</th><th className="p-3" /></tr></thead>
            <tbody>
              {cafes.data.map((c) => (
                <tr key={c.id} data-testid="cafe-row" className="border-b border-line last:border-0">
                  <td className="p-3"><div className="font-medium text-fg">{c.name}</div><div className="text-xs text-muted font-mono">{c.code}</div></td>
                  <td className="p-3"><Badge tone="neutral">{c.subscriptionPlan}</Badge></td>
                  <td className="p-3">{c.outletsCount ?? 0} / {limitText(c.maxOutlets)}</td>
                  <td className="p-3">{c.usersCount ?? 0}{c.maxUsers ? ` / ${limitText(c.maxUsers)}` : ''}</td>
                  <td className="p-3">{inr(c.totalGmv)}</td>
                  <td className="p-3"><Badge tone={c.status === 'ACTIVE' ? 'ok' : c.status === 'SUSPENDED' ? 'warn' : 'danger'}>{c.status}</Badge></td>
                  <td className="p-3"><div className="flex justify-end gap-1.5 flex-wrap">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(c)}>Plan</button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setBridge(c)} title="Print bridge token"><i className="fa-solid fa-key" /></button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => void copyText(`${window.location.origin}/?cafe=${c.code}`, 'sign-in link')} title="Copy the sign-in link"><i className="fa-solid fa-link" /></button>
                    {(c.status === 'ACTIVE' || c.status === 'SUSPENDED') && <button type="button" className={`btn btn-sm ${c.status === 'ACTIVE' ? 'btn-ghost hover:!text-danger' : 'btn-soft'}`} disabled={toggle.isPending} onClick={() => toggle.mutate(c)}>{c.status === 'ACTIVE' ? 'Suspend' : 'Activate'}</button>}
                  </div></td>
                </tr>))}
            </tbody>
          </table>
        </div>)}

      <PasswordCard />
      {creating && <NewCafeDialog onClose={() => setCreating(false)} onCreated={() => { setCreating(false); refresh(); }} />}
      {editing && <PlanDialog cafe={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />}
      {bridge && <BridgeDialog cafe={bridge} onClose={() => setBridge(null)} />}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="card p-3"><p className="text-xs text-muted">{label}</p><p className="text-lg font-semibold text-fg">{value}</p></div>;
}

function NewCafeDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [f, setF] = useState<NewCafe & { codeEdited: boolean }>({ name: '', code: '', contactEmail: '', contactPhone: '', address: '', subscriptionPlan: 'PRO', maxOutlets: 5, adminUsername: 'owner', adminPassword: '', adminFullName: '', codeEdited: false });
  const set = (p: Partial<typeof f>) => setF({ ...f, ...p });
  const create = useMutation({
    mutationFn: () => createCafe({
      name: f.name.trim(), code: f.code, contactEmail: f.contactEmail, contactPhone: f.contactPhone, address: f.address,
      subscriptionPlan: f.subscriptionPlan, maxOutlets: f.maxOutlets, adminUsername: f.adminUsername.trim(), adminPassword: f.adminPassword, adminFullName: f.adminFullName,
    }),
    onSuccess: () => { showToast('Cafe created. The owner can sign in with the cafe code.', 'success'); onCreated(); },
    onError: (e: Error) => showToast(e.message, 'error'),
  });
  const submit = () => {
    if (!f.name.trim()) return showToast('The cafe needs a name.', 'error');
    if (!CAFE_CODE.test(f.code)) return showToast('The cafe code must be 3 to 30 characters: lower-case letters, digits and dashes.', 'error');
    const problem = passwordProblem(f.adminPassword);
    if (problem) return showToast(`Owner password: ${problem}`, 'error');
    create.mutate();
  };
  return (
    <Dialog id="newCafeModal" open onClose={onClose} title="New cafe" description="It gets its own database. The owner account is created now." size="lg">
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field id="cafeNameNew" label="Cafe name"><input id="cafeNameNew" className="input" autoFocus value={f.name} onChange={(e) => set({ name: e.target.value, ...(f.codeEdited ? {} : { code: suggestCode(e.target.value) }) })} /></Field>
          <Field id="cafeCodeNew" label="Cafe code" hint="Staff type it to sign in. It cannot be changed later."><input id="cafeCodeNew" className="input font-mono" value={f.code} onChange={(e) => set({ code: e.target.value.toLowerCase(), codeEdited: true })} /></Field>
          <Field id="cafeMailNew" label="Contact email"><input id="cafeMailNew" type="email" className="input" value={f.contactEmail} onChange={(e) => set({ contactEmail: e.target.value })} /></Field>
          <Field id="cafePhoneNew" label="Contact phone"><input id="cafePhoneNew" className="input" value={f.contactPhone} onChange={(e) => set({ contactPhone: e.target.value })} /></Field>
          <Field id="cafePlanNew" label="Plan"><select id="cafePlanNew" className="input" value={f.subscriptionPlan} onChange={(e) => set({ subscriptionPlan: e.target.value, maxOutlets: PLAN_LIMITS[e.target.value as PlanName].branches })}>{PLANS.map((p) => <option key={p}>{p}</option>)}</select></Field>
          <PlanSummary plan={f.subscriptionPlan as PlanName} />
          <Field id="cafeMaxNew" label="Branches allowed" hint="999 or more means no limit."><input id="cafeMaxNew" type="number" min={1} className="input" value={f.maxOutlets} onChange={(e) => set({ maxOutlets: Math.max(1, Number(e.target.value) || 1) })} /></Field>
        </div>
        <fieldset className="rounded-lg border border-line p-3 space-y-3"><legend className="px-1 text-xs font-medium text-muted">Owner account</legend>
          <div className="grid sm:grid-cols-3 gap-3">
            <Field id="ownerUserNew" label="Username"><input id="ownerUserNew" className="input" value={f.adminUsername} onChange={(e) => set({ adminUsername: e.target.value })} autoComplete="off" /></Field>
            <Field id="ownerNameNew" label="Full name"><input id="ownerNameNew" className="input" value={f.adminFullName} onChange={(e) => set({ adminFullName: e.target.value })} /></Field>
            <Field id="ownerPassNew" label="Password" hint="8+ with upper, lower, digit and a symbol."><input id="ownerPassNew" type="password" className="input" value={f.adminPassword} onChange={(e) => set({ adminPassword: e.target.value })} autoComplete="new-password" /></Field>
          </div>
        </fieldset>
        <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button><button type="submit" disabled={create.isPending} className="btn btn-primary">{create.isPending ? 'Creating…' : 'Create cafe'}</button></div>
      </form>
    </Dialog>
  );
}

function PlanDialog({ cafe, onClose, onSaved }: { cafe: Cafe; onClose: () => void; onSaved: () => void }) {
  const [plan, setPlan] = useState(cafe.subscriptionPlan);
  const [max, setMax] = useState(cafe.maxOutlets);
  const save = useMutation({
    mutationFn: () => updateCafe(cafe.id, { subscriptionPlan: plan, maxOutlets: max }),
    onSuccess: () => { showToast('Plan updated.', 'success'); onSaved(); },
    onError: (e: Error) => showToast(e.message, 'error'),
  });
  return (
    <Dialog id="planModal" open onClose={onClose} title={`${cafe.name}: plan`} size="sm">
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <Field id="planSel" label="Plan"><select id="planSel" className="input" value={plan} onChange={(e) => { setPlan(e.target.value); setMax(Math.max(PLAN_LIMITS[e.target.value as PlanName].branches, cafe.outletsCount ?? 1)); }}>{PLANS.map((p) => <option key={p}>{p}</option>)}</select></Field>
        <PlanSummary plan={plan as PlanName} />
        <Field id="planMax" label="Branches allowed" hint={`${cafe.outletsCount ?? 0} in use now. 999 or more means no limit.`}><input id="planMax" type="number" min={Math.max(1, cafe.outletsCount ?? 1)} className="input" value={max} onChange={(e) => setMax(Number(e.target.value) || 1)} /></Field>
        <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button><button type="submit" disabled={save.isPending} className="btn btn-primary">Save</button></div>
      </form>
    </Dialog>
  );
}

/** What a plan gives: its two limits and which modules are in or out, so the choice is made with the facts in front of you. */
function PlanSummary({ plan }: { plan: PlanName }) {
  return (
    <div className="sm:col-span-2 rounded-lg border border-line bg-subtle/60 p-3 text-xs space-y-2" data-testid="plan-summary">
      <p className="font-medium text-fg">{plan}: {planLimitsText(plan)}</p>
      <ul className="grid sm:grid-cols-2 gap-x-4 gap-y-1">
        {MODULES.map((m) => {
          const on = planIncludes(plan, m);
          return (
            <li key={m.id} className={on ? 'text-fg' : 'text-muted line-through decoration-muted/50'}>
              <i className={`fa-solid ${on ? 'fa-check text-ok' : 'fa-xmark text-muted'} w-4`} />{m.label}{!on && <span className="no-underline"> ({m.plan})</span>}
            </li>
          );
        })}
      </ul>
      <p className="text-muted">Also in every plan: till and tables, kitchen display, bills, menu, basic stock, analytics, printing.</p>
    </div>
  );
}

function BridgeDialog({ cafe, onClose }: { cafe: Cafe; onClose: () => void }) {
  const token = useQuery({ queryKey: ['platform', 'bridge', cafe.id], queryFn: () => revealBridgeToken(cafe.id), staleTime: 0, gcTime: 0 });
  const [rotated, setRotated] = useState<string | null>(null);
  const rotate = useMutation({
    mutationFn: () => rotateBridgeToken(cafe.id),
    onSuccess: (r) => { setRotated(r.bridgeToken); showToast('New token created. The old one stops working at once: update the bridge.', 'warning'); },
    onError: (e: Error) => showToast(e.message, 'error'),
  });
  const value = rotated ?? token.data?.bridgeToken ?? '';
  return (
    <Dialog id="bridgeModal" open onClose={onClose} title={`${cafe.name}: print bridge`} description="The bridge of this cafe signs in with this token and its cafe code. Each cafe has its own." size="md">
      <div className="space-y-3">
        <Field id="bridgeCode" label="Cafe code (TENANT_CODE)"><input id="bridgeCode" readOnly className="input font-mono" value={cafe.code} /></Field>
        <Field id="bridgeTok" label="Bridge token (PRINTER_BRIDGE_TOKEN)"><div className="flex gap-2"><input id="bridgeTok" readOnly className="input font-mono" value={token.isPending ? 'Loading…' : value} onFocus={(e) => e.currentTarget.select()} />
          <button type="button" className="btn btn-secondary shrink-0" disabled={!value} onClick={() => void copyText(value, 'token')}><i className="fa-solid fa-copy" /></button></div></Field>
        <p className="hint">Opening this is recorded in the cafe's history.</p>
        <div className="flex justify-between gap-2"><button type="button" className="btn btn-ghost hover:!text-danger" disabled={rotate.isPending} onClick={() => { if (window.confirm('Create a new token? The current one stops working immediately and the bridge must be reflashed.')) rotate.mutate(); }}><i className="fa-solid fa-rotate" />New token</button><button type="button" className="btn btn-secondary" onClick={onClose}>Close</button></div>
      </div>
    </Dialog>
  );
}

function PasswordCard() {
  const [cur, setCur] = useState(''); const [next, setNext] = useState(''); const [again, setAgain] = useState('');
  const patchUser = useSession((s) => s.patchUser);
  const save = useMutation({
    mutationFn: () => changePlatformPassword(cur, next),
    onSuccess: () => { setCur(''); setNext(''); setAgain(''); patchUser({ mustChangePassword: false }); showToast('Password changed.', 'success'); },
    onError: (e: Error) => showToast(e.message, 'error'),
  });
  const submit = () => {
    if (next !== again) return showToast('The new passwords do not match.', 'error');
    const problem = passwordProblem(next);
    if (problem) return showToast(problem, 'error');
    save.mutate();
  };
  return (
    <form className="card p-5 space-y-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <h2 className="font-medium text-fg">Change my password</h2>
      <div className="grid sm:grid-cols-3 gap-3">
        <Field id="platCur" label="Current password"><input id="platCur" type="password" className="input" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" /></Field>
        <Field id="platNew" label="New password"><input id="platNew" type="password" className="input" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" /></Field>
        <Field id="platAgain" label="Repeat new password"><input id="platAgain" type="password" className="input" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" /></Field>
      </div>
      <div className="flex justify-end"><button type="submit" disabled={save.isPending || !cur || !next} className="btn btn-secondary">Change password</button></div>
    </form>
  );
}
