import { useState } from 'react';
import { useSession } from '../../api/session';
import { useQueryClient } from '@tanstack/react-query';
import { showToast } from '../../components/toast';
import { Field, PageHeader, SegmentedTabs } from '../../components/ui';
import { saveBlob } from '../../lib/download';
import { useSafeMutation as useMutation } from '../../lib/useSafeMutation';
import { exportReport, type Period, type Query } from './api';
import { BudgetTab } from './BudgetTab';
import { DailyCloseTab } from './DailyCloseTab';
import { DrawerTab } from './DrawerTab';
import { CustomizeDialog } from './CustomizeDialog';
import { DEFAULT_LAYOUT, loadLayout, saveLayout, sameLayout, type Layout } from './layout';
import { OverviewTab } from './OverviewTab';
import { StaffTab } from './StaffTab';
import { AccountingTab } from './AccountingTab';
import { BankingTab } from './BankingTab';
import { ReportsCatalogTab } from './ReportsCatalogTab';
import { hasFeature } from '../../api/roles';
import type { FeatureId } from '../../api/types';
import { PERIODS, customRangeProblem, defaultCustomRange, exportFileName } from './rules';

export function AnalyticsPage() {
  const qc = useQueryClient();
  const [sub, setSub] = useState<'overview' | 'daily' | 'budget' | 'staff' | 'drawer' | 'accounting' | 'banking' | 'reports'>('overview');
  const [period, setPeriod] = useState<Period>('THIS_MONTH');
  const [range, setRange] = useState(defaultCustomRange());
  const [applied, setApplied] = useState({ start: '', end: '' });
  const username = useSession((s) => s.user?.username) ?? '';
  const user = useSession((s) => s.user);
  const has = (f: FeatureId) => !user || hasFeature(user, f);
  const [layout, setLayoutState] = useState<Layout>(() => loadLayout(username));
  const [customize, setCustomize] = useState(false);
  const setLayout = (l: Layout) => { setLayoutState(l); saveLayout(username, l); };
  const q: Query = { period, start: applied.start, end: applied.end };

  // each section belongs to the module that supplies its data; a plan without it does not show the section
  const sections = ([
    { value: 'overview', label: 'Business overview', id: 'atab-overview' },
    { value: 'accounting', label: 'Statutory P&L & Balance Sheet', id: 'atab-accounting', needs: 'ACCOUNTING' },
    { value: 'banking', label: 'Bank Reconciliation', id: 'atab-banking', needs: 'ACCOUNTING' },
    { value: 'reports', label: 'Reports Catalog', id: 'atab-reports', needs: 'EXPORTS' },
    { value: 'daily', label: 'Daily close', id: 'atab-daily' },
    { value: 'budget', label: 'Budget', id: 'atab-budget', needs: 'SUPPLIERS_EXPENSES' },
    { value: 'staff', label: 'Staff & tips', id: 'atab-staff' },
    { value: 'drawer', label: 'Drawer & shift analysis', id: 'atab-drawer' },
  ] as const).filter((o) => !('needs' in o) || has(o.needs));
  const shown = sections.some((o) => o.value === sub) ? sub : 'overview';

  const exp = useMutation({
    mutationFn: (format: 'pdf' | 'excel') => { showToast(`Generating ${format === 'excel' ? 'Excel' : 'PDF'} analytics report for ${period}...`, 'info'); return exportReport(format, q).then((r) => ({ ...r, format })); },
    onSuccess: ({ blob, filename, format }) => { saveBlob(blob, filename || exportFileName(format, period)); showToast(`Analytics ${format === 'excel' ? 'Excel' : 'PDF'} report downloaded successfully!`, 'success'); },
    onError: (e: Error) => showToast(`Export failed: ${e.message}`, 'error'),
  });
  const apply = () => { const p = customRangeProblem(range.start, range.end); if (p) { showToast(p, 'warning'); return; } setApplied(range); };
  const onExport = (format: 'pdf' | 'excel') => { if (period === 'CUSTOM' && customRangeProblem(applied.start, applied.end)) { showToast('Please specify both start and end date for custom export', 'warning'); return; } exp.mutate(format); };

  return (
    <section id="tab-analytics" data-testid="tab-analytics" className="space-y-5">
      <PageHeader title="Business analytics" description="Management control centre for finance, inventory and shift cash."
        actions={<span id="analyticsExportActions" className="flex flex-wrap gap-2">
          <button type="button" id="btnAnalyticsCustomize" onClick={() => setCustomize(true)} title="Choose which sections to show and their order" className="btn btn-secondary"><i className="fa-solid fa-sliders" />Customize{!sameLayout(layout, DEFAULT_LAYOUT) && <span className="badge badge-info ml-1">on</span>}</button>
          <button type="button" onClick={() => void qc.invalidateQueries({ queryKey: ['analytics'] })} title="Refresh" className="btn btn-secondary"><i className="fa-solid fa-rotate" />Refresh</button>
          {has('EXPORTS') && <button type="button" id="btnExportAnalyticsPdf" disabled={exp.isPending} onClick={() => onExport('pdf')} title="Export selected analytics to a PDF document" className="btn btn-secondary"><i className="fa-solid fa-file-pdf text-danger" />Export PDF</button>}
          {has('EXPORTS') && <button type="button" id="btnExportAnalyticsExcel" disabled={exp.isPending} onClick={() => onExport('excel')} title="Export selected analytics to an Excel (.xlsx) spreadsheet" className="btn btn-secondary"><i className="fa-solid fa-file-excel text-ok" />Export Excel</button>}
        </span>} />

      <div className="max-w-full">
        <SegmentedTabs
          wrap
          label="Analytics sections"
          value={shown}
          onChange={setSub}
          options={sections}
        />
      </div>

      {shown === 'overview' && (<>
        <div className="card p-3 flex flex-wrap items-end gap-2">
          <div id="analyticsPeriodPills" className="max-w-full"><SegmentedTabs wrap label="Period" value={period} onChange={setPeriod} options={PERIODS.map(([v, l]) => ({ value: v, label: l, id: `pill-${v}` }))} /></div>
          {period === 'CUSTOM' && <div id="analyticsCustomDateBox" className="flex items-end gap-2 flex-wrap"><Field id="analyticsStartDate" label="From"><input id="analyticsStartDate" type="date" value={range.start} onChange={(e) => setRange({ ...range, start: e.target.value })} className="input" /></Field><Field id="analyticsEndDate" label="To"><input id="analyticsEndDate" type="date" value={range.end} onChange={(e) => setRange({ ...range, end: e.target.value })} className="input" /></Field><button type="button" onClick={apply} className="btn btn-primary h-10">Apply</button></div>}
        </div>
        <OverviewTab q={q} layout={layout} />
      </>)}
      {shown === 'accounting' && <AccountingTab />}
      {shown === 'banking' && <BankingTab />}
      {shown === 'reports' && <ReportsCatalogTab />}
      {shown === 'daily' && <DailyCloseTab />}
      {shown === 'budget' && <BudgetTab />}
      {shown === 'staff' && <StaffTab />}
      {shown === 'drawer' && <DrawerTab />}
      <CustomizeDialog open={customize} onClose={() => setCustomize(false)} layout={layout} onChange={setLayout} />
    </section>
  );
}
