import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge, EmptyState, Field, Skeleton } from '../../components/ui';
import { showToast } from '../../components/toast';
import {
  fetchBankStatements,
  fetchBankStatementRows,
  importBankStatement,
  matchBankRow,
  unmatchBankRow,
  autoMatchBankRows,
  type BankStatementRow,
} from './api';

const inr = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function BankingTab() {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedStatementId, setSelectedStatementId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [matchingRow, setMatchingRow] = useState<BankStatementRow | null>(null);
  const [expenseIdInput, setExpenseIdInput] = useState<string>('');

  const statementsQ = useQuery({
    queryKey: ['banking-statements'],
    queryFn: fetchBankStatements,
  });

  const rowsQ = useQuery({
    queryKey: ['banking-rows', selectedStatementId, statusFilter],
    queryFn: () => (selectedStatementId ? fetchBankStatementRows(selectedStatementId, statusFilter) : Promise.resolve([])),
    enabled: !!selectedStatementId,
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('description', file.name.replace(/\.[^/.]+$/, ''));
      return importBankStatement(fd);
    },
    onSuccess: (res) => {
      showToast(`Imported ${res.importedRows} statement row(s). ${res.autoMatchedCount} automatically matched!`, 'success');
      qc.invalidateQueries({ queryKey: ['banking-statements'] });
      if (res.statementId) setSelectedStatementId(res.statementId);
    },
    onError: (e: Error) => showToast(`Failed to import statement: ${e.message}`, 'error'),
  });

  const autoMatchMutation = useMutation({
    mutationFn: autoMatchBankRows,
    onSuccess: (res) => {
      showToast(`Auto-matched ${res.autoMatchedCount} row(s) against operating expenses!`, 'success');
      qc.invalidateQueries({ queryKey: ['banking-rows'] });
      qc.invalidateQueries({ queryKey: ['banking-statements'] });
    },
    onError: (e: Error) => showToast(`Auto-match error: ${e.message}`, 'error'),
  });

  const matchMutation = useMutation({
    mutationFn: ({ rowId, expenseId }: { rowId: number; expenseId: number }) => matchBankRow(rowId, expenseId),
    onSuccess: () => {
      showToast('Row matched successfully', 'success');
      setMatchingRow(null);
      setExpenseIdInput('');
      qc.invalidateQueries({ queryKey: ['banking-rows'] });
      qc.invalidateQueries({ queryKey: ['banking-statements'] });
    },
    onError: (e: Error) => showToast(`Match failed: ${e.message}`, 'error'),
  });

  const unmatchMutation = useMutation({
    mutationFn: (rowId: number) => unmatchBankRow(rowId),
    onSuccess: () => {
      showToast('Row unmatched', 'info');
      qc.invalidateQueries({ queryKey: ['banking-rows'] });
      qc.invalidateQueries({ queryKey: ['banking-statements'] });
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
      e.target.value = '';
    }
  };

  const statements = statementsQ.data ?? [];
  const rows = rowsQ.data ?? [];

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="card p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-fg">Bank Statement Reconciliation</h3>
          <p className="text-xs text-muted">Upload bank statements, deduplicate transactions via SHA-256, and match with cafe expenses.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".csv"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
            className="btn btn-primary"
          >
            <i className="fa-solid fa-file-csv mr-1" />
            {uploadMutation.isPending ? 'Uploading...' : 'Import Statement (CSV)'}
          </button>
          <button
            type="button"
            onClick={() => autoMatchMutation.mutate()}
            disabled={autoMatchMutation.isPending}
            className="btn btn-secondary"
          >
            <i className="fa-solid fa-wand-magic-sparkles mr-1 text-brand-text" />
            Auto-Match All
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Statements List */}
        <div className="card p-4 space-y-3">
          <h4 className="text-sm font-semibold text-fg border-b border-line pb-2">Uploaded Statements</h4>
          {statementsQ.isLoading ? (
            <Skeleton rows={4} />
          ) : statements.length === 0 ? (
            <EmptyState icon="fa-solid fa-file-invoice" title="No statements yet" hint="Import a CSV bank statement to begin reconciliation." />
          ) : (
            <div className="divide-y divide-line max-h-96 overflow-y-auto">
              {statements.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedStatementId(s.id)}
                  className={`w-full text-left p-2.5 rounded-lg transition flex flex-col gap-1 ${
                    selectedStatementId === s.id ? 'bg-surface shadow-card' : 'hover:bg-subtle'
                  }`}
                >
                  <div className="flex justify-between items-center text-sm font-medium text-fg">
                    <span className="truncate">{s.description}</span>
                    <Badge tone={s.unmatchedCount === 0 ? 'ok' : 'warn'}>
                      {s.unmatchedCount === 0 ? 'Reconciled' : `${s.unmatchedCount} pending`}
                    </Badge>
                  </div>
                  <div className="flex justify-between text-xs text-muted">
                    <span>{new Date(s.importDate).toLocaleDateString()}</span>
                    <span>{s.matchedCount} / {s.rowCount} matched</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Rows List */}
        <div className="lg:col-span-2 card p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2">
            <h4 className="text-sm font-semibold text-fg">Transaction Rows</h4>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input py-0 h-8 text-xs w-36"
              >
                <option value="">All Statuses</option>
                <option value="UNMATCHED">Unmatched Only</option>
                <option value="MATCHED">Matched Only</option>
              </select>
            </div>
          </div>

          {!selectedStatementId ? (
            <div className="p-8 text-center text-muted text-sm">Select a statement on the left to inspect and reconcile its transactions.</div>
          ) : rowsQ.isLoading ? (
            <Skeleton rows={6} />
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-muted text-sm">No transaction rows found for this filter.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="rtable">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-subtle">
                      <td data-label="" className="font-mono cell-title">{r.transactionDate}</td>
                      <td data-label="Description" className="max-w-xs truncate">
                        {r.description}
                        {r.matchedExpenseDescription && (
                          <div className="text-[10px] text-ok mt-0.5 font-medium">
                            Matched: {r.matchedExpenseDescription} ({inr(r.matchedExpenseAmount || 0)})
                          </div>
                        )}
                      </td>
                      <td data-label="Amount" className="">
                        {inr(r.amount)}
                      </td>
                      <td data-label="Status" className="">
                        <Badge tone={r.status === 'MATCHED' ? 'ok' : r.status === 'IGNORED' ? 'neutral' : 'warn'}>
                          {r.status}
                        </Badge>
                      </td>
                      <td data-label="Action" className="text-right cell-actions">
                        {r.status === 'MATCHED' ? (
                          <button
                            type="button"
                            onClick={() => unmatchMutation.mutate(r.id)}
                            className="btn btn-ghost btn-sm text-danger"
                          >
                            Unmatch
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setMatchingRow(r);
                              setExpenseIdInput('');
                            }}
                            className="btn btn-secondary btn-sm"
                          >
                            Match
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Manual Match Modal */}
      {matchingRow && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="card max-w-md w-full p-4 space-y-4">
            <h4 className="font-semibold text-fg">Manual Match with Expense</h4>
            <p className="text-xs text-muted">
              Matching transaction: <span className="font-semibold">{matchingRow.description}</span> ({inr(matchingRow.amount)}) on {matchingRow.transactionDate}.
            </p>
            <Field id="matchExpenseId" label="Enter Operating Expense ID">
              <input
                id="matchExpenseId"
                type="number"
                placeholder="e.g. 42"
                value={expenseIdInput}
                onChange={(e) => setExpenseIdInput(e.target.value)}
                className="input"
              />
            </Field>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMatchingRow(null)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = Number(expenseIdInput);
                  if (id > 0) matchMutation.mutate({ rowId: matchingRow.id, expenseId: id });
                }}
                disabled={!expenseIdInput}
                className="btn btn-primary"
              >
                Confirm Match
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
