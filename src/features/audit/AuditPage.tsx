import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { showToast } from '../../components/toast';
import { Badge, EmptyState, PageHeader, SearchInput, SegmentedTabs, Skeleton } from '../../components/ui';
import { formatISTDateTime } from '../../lib/time';
import { auditKey, fetchAudit, type AuditLog } from './api';
import { ACTIONS, CATEGORIES, NO_FILTERS, actionBadge, auditStats, auditUsers, billDiff, filterAudit, type AuditFilters } from './rules';

function Details({ l }: { l: AuditLog }) {
  if (l.oldValue && l.newValue) {
    const diff = billDiff(l.newValue);
    return (
      <div className="space-y-1.5 font-mono text-xs">
        <p className="flex items-start gap-1.5"><span className="badge badge-danger shrink-0">BEFORE</span><span className="text-muted line-through break-words flex-1">{l.oldValue}</span></p>
        <p className="flex items-start gap-1.5"><span className="badge badge-ok shrink-0">AFTER</span><span className="text-fg font-medium break-words flex-1">{l.newValue}</span></p>
        {diff && <p className="flex flex-wrap items-center gap-1.5"><Badge tone={diff.negative ? 'danger' : 'ok'} icon={diff.negative ? 'fa-triangle-exclamation' : 'fa-arrow-trend-up'}>Net amount changed: {diff.text}</Badge>{diff.negative && <span className="text-xs font-medium text-danger">(Amount reduced – anomaly flag)</span>}</p>}
      </div>
    );
  }
  return <p className="font-mono text-xs text-fg bg-subtle rounded-lg px-2.5 py-1.5 break-all">{l.newValue || l.oldValue || '-'}</p>;
}

export function AuditPage() {
  const q = useQuery({ queryKey: auditKey, queryFn: fetchAudit });
  const [f, setF] = useState<AuditFilters>(NO_FILTERS);
  const logs = q.data ?? [];
  const rows = filterAudit(logs, f);
  const stats = auditStats(logs);
  const set = (p: Partial<AuditFilters>) => setF({ ...f, ...p });
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const err = q.isError ? q.error.message : '';
  useEffect(() => { if (err) showToast(`Failed to load audit logs: ${err}`, 'error'); }, [err]);

  return (
    <section id="tab-audit" data-testid="tab-audit" className="space-y-5">
      <PageHeader title="Security & activity audit log" description="Audit trail of billing, inventory, user security and system actions." id="auditTabSubtitle"
        actions={<SegmentedTabs label="Audit view" value={f.mode} onChange={(mode) => set({ mode })} options={[{ value: 'all', label: 'All activity', id: 'btnAuditModeAll' }, { value: 'bills', label: 'Bill audit', id: 'btnAuditModeBills' }]} />} />

      <p id="auditBannerText" className="text-sm text-muted"><i className={`fa-solid ${f.mode === 'bills' ? 'fa-receipt text-brand-text' : 'fa-list-check text-info'} mr-1.5`} />
        {f.mode === 'bills' ? <>Showing <strong className="text-fg">bill lifecycle audit</strong> (created, edited, cancelled, deleted, printed)</> : <>Showing <strong className="text-fg">all system activity logs</strong></>}</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[['statAuditTotal', 'Total events', stats.total, 'text-fg'], ['statAuditBills', 'Bill operations', stats.billOps, 'text-brand-text'], ['statAuditBillEdits', 'Bill edits / cancels / deletes', stats.billEdits, 'text-danger'], ['statAuditUsers', 'Active users', stats.users, 'text-info']].map(([id, label, v, tone]) =>
          <div key={String(id)} className="card p-4"><p className="text-xs text-muted">{label}</p><p id={String(id)} className={`text-2xl font-semibold mt-1 ${tone}`}>{v}</p></div>)}
      </div>

      <div className="card p-3 grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2 items-center">
        <div className="flex gap-1.5"><input id="auditDateFilter" type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} className="input" aria-label="Date" /><button type="button" id="btnAuditToday" onClick={() => set({ date: today() })} className="btn btn-secondary px-3">Today</button></div>
        <select id="auditUserFilter" value={f.user} onChange={(e) => set({ user: e.target.value })} className="input" aria-label="User"><option value="ALL">All users</option>{auditUsers(logs).map((u) => <option key={u} value={u}>{u}</option>)}</select>
        <select id="auditCategoryFilter" value={f.category} disabled={f.mode === 'bills'} onChange={(e) => set({ category: e.target.value })} className="input disabled:opacity-40" aria-label="Category"><option value="ALL">All categories</option>{CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <select id="auditActionFilter" value={f.action} onChange={(e) => set({ action: e.target.value })} className="input" aria-label="Action"><option value="ALL">All actions</option>{ACTIONS.map(([v, l]) => <option key={v} value={v}>{v} ({l})</option>)}</select>
        <div className="lg:col-span-2 flex gap-1.5 items-center"><div className="flex-1"><SearchInput id="auditSearchInput" value={f.search} onChange={(search) => set({ search })} placeholder="Search bill #, detail, user…" /></div>
          <button type="button" id="btnAuditReset" onClick={() => setF(NO_FILTERS)} className="btn btn-ghost px-3" title="Reset Filters" aria-label="Reset filters"><i className="fa-solid fa-rotate-left" /></button></div>
      </div>
      <p id="auditRecordCount" className="text-sm text-muted">{rows.length} log{rows.length === 1 ? '' : 's'} found</p>

      <div className="card overflow-hidden">
        {q.isPending ? <Skeleton rows={6} /> : (
          <table className="rtable">
            <thead><tr><th>When</th><th>Action</th><th>Category</th><th>User</th><th>Details</th></tr></thead>
            <tbody id="auditTableBody">
              {rows.length === 0 && <tr><td colSpan={5}><EmptyState icon="fa-clipboard-question" title="No matching audit logs found" hint="Try resetting the filters or checking another user or category." /></td></tr>}
              {rows.map((l) => {
                const b = actionBadge(l.action);
                return (
                  <tr key={l.id} className="align-top">
                    <td data-label="" className="cell-title font-mono text-xs text-fg whitespace-nowrap">{formatISTDateTime(l.performedAt)}</td>
                    <td data-label="Action"><Badge tone={b.tone} icon={b.icon}>{(l.action || '').toUpperCase()}</Badge></td>
                    <td data-label="Category"><Badge>{(l.entityType || '').toUpperCase()}{l.entityId ? ` #${l.entityId}` : ''}</Badge></td>
                    <td data-label="User" className="font-medium text-fg whitespace-nowrap"><i className="fa-solid fa-circle-user text-brand-text mr-1.5 text-xs" />{l.performedByName || 'System'}</td>
                    <td data-label="Details" className="max-w-xl w-full md:w-auto"><Details l={l} /></td>
                  </tr>);
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
