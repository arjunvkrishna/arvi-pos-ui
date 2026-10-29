import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Badge, Field, Skeleton } from '../../components/ui';
import { showToast } from '../../components/toast';
import { fetchReportCatalog, submitReportExport, fetchReportJobStatus, type ExportJobStatus } from './api';

export function ReportsCatalogTab() {
  const [selectedReportId, setSelectedReportId] = useState<string>('sales_summary');
  const [format, setFormat] = useState<string>('XLSX');
  const [dates, setDates] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  const [jobStatus, setJobStatus] = useState<ExportJobStatus | null>(null);

  const catalogQ = useQuery({
    queryKey: ['report-catalog'],
    queryFn: fetchReportCatalog,
    staleTime: 600_000,   // the list of reports only changes with a new release
  });

  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopPolling = () => { if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; } };
  useEffect(() => stopPolling, []);   // leaving the tab ends the check

  const exportMutation = useMutation({
    mutationFn: () =>
      submitReportExport({
        reportId: selectedReportId,
        format,
        filterParams: { startDate: dates.start, endDate: dates.end },
      }),
    onSuccess: (job) => {
      setJobStatus(job);
      showToast(`Submitted export job for ${job.reportId}. Processing...`, 'info');
      pollJob(job.jobId);
    },
    onError: (e: Error) => showToast(`Failed to trigger export: ${e.message}`, 'error'),
  });

  const pollJob = (id: string) => {
    stopPolling();
    const startedAt = Date.now();
    const interval = setInterval(async () => {
      if (Date.now() - startedAt > 5 * 60_000) { stopPolling(); return; }   // never check forever
      try {
        const status = await fetchReportJobStatus(id);
        setJobStatus(status);
        if (status.status === 'COMPLETED') {
          clearInterval(interval);
          showToast(`Report ${status.reportId} (${status.format}) is ready!`, 'success');
          // Trigger download
          if (status.downloadUrl) {
            window.open(status.downloadUrl, '_blank');
          }
        } else if (status.status === 'FAILED') {
          clearInterval(interval);
          showToast(`Export job failed: ${status.errorMessage || 'Unknown error'}`, 'error');
        }
      } catch {
        clearInterval(interval);
      }
    }, 1500);
    pollTimer.current = interval;
  };

  const reports = catalogQ.data ?? [];
  const selectedReport = reports.find((r) => r.id === selectedReportId) || reports[0];

  return (
    <div className="space-y-6">
      <div className="card p-4 space-y-2">
        <h3 className="text-base font-semibold text-fg">18-Named Enterprise Reports Catalog</h3>
        <p className="text-xs text-muted">
          Asynchronously generate and stream comprehensive management reports in CSV, XLSX, and PDF formats.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Reports Selector */}
        <div className="card p-4 space-y-3">
          <h4 className="text-sm font-semibold text-fg border-b border-line pb-2">Select Report</h4>
          {catalogQ.isLoading ? (
            <Skeleton rows={6} />
          ) : (
            <div className="space-y-1 max-h-[500px] overflow-y-auto divide-y divide-line">
              {reports.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedReportId(r.id)}
                  className={`w-full text-left p-2.5 rounded-lg transition flex flex-col gap-0.5 ${
                    selectedReportId === r.id ? 'bg-surface shadow-card' : 'hover:bg-subtle'
                  }`}
                >
                  <div className="flex justify-between items-center text-sm font-medium text-fg">
                    <span>{r.title}</span>
                    <Badge tone="neutral">{r.category}</Badge>
                  </div>
                  <span className="text-xs text-muted line-clamp-1">{r.description}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Configuration & Trigger */}
        <div className="lg:col-span-2 card p-5 space-y-5">
          {selectedReport && (
            <div className="space-y-4">
              <div>
                <h4 className="text-lg font-bold text-fg">{selectedReport.title}</h4>
                <p className="text-sm text-muted mt-1">{selectedReport.description}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <Field id="reportStartDate" label="Start Date">
                  <input
                    id="reportStartDate"
                    type="date"
                    value={dates.start}
                    onChange={(e) => setDates({ ...dates, start: e.target.value })}
                    className="input"
                  />
                </Field>
                <Field id="reportEndDate" label="End Date">
                  <input
                    id="reportEndDate"
                    type="date"
                    value={dates.end}
                    onChange={(e) => setDates({ ...dates, end: e.target.value })}
                    className="input"
                  />
                </Field>
              </div>

              <div>
                <label className="text-xs font-semibold text-fg block mb-2">Export Format</label>
                <div className="flex gap-2">
                  {selectedReport.supportedFormats.map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setFormat(fmt)}
                      className={`btn ${format === fmt ? 'btn-primary' : 'btn-secondary'} px-4`}
                    >
                      <i className={`fa-solid mr-1.5 ${fmt === 'XLSX' ? 'fa-file-excel text-ok' : fmt === 'PDF' ? 'fa-file-pdf text-danger' : 'fa-file-csv'}`} />
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-line flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => exportMutation.mutate()}
                  disabled={exportMutation.isPending || jobStatus?.status === 'PROCESSING'}
                  className="btn btn-primary h-11 px-6 text-sm"
                >
                  <i className="fa-solid fa-cloud-arrow-down mr-2" />
                  {jobStatus?.status === 'PROCESSING' ? 'Generating Report...' : `Generate & Export (${format})`}
                </button>

                {jobStatus && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted">Status:</span>
                    <Badge tone={jobStatus.status === 'COMPLETED' ? 'ok' : jobStatus.status === 'FAILED' ? 'danger' : 'warn'}>
                      {jobStatus.status}
                    </Badge>
                    {jobStatus.downloadUrl && (
                      <a
                        href={jobStatus.downloadUrl}
                        download
                        className="btn btn-secondary btn-sm"
                      >
                        <i className="fa-solid fa-download mr-1" />
                        Download
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
