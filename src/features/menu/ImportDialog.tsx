import { Dialog } from '../../components/Dialog';
import { Badge } from '../../components/ui';
import { useMenuAction } from './hooks';
import { applyImport, type ImportPreview } from './api';
import { rupees } from './rules';

export interface PendingImport { payload: unknown; fileName: string; result: ImportPreview }

/** Review step of the bulk price import: nothing is written until "Confirm" is pressed. */
export function ImportDialog({ pending, onClose }: { pending: PendingImport; onClose: () => void }) {
  const { result, fileName } = pending;
  const rows = result.rows ?? [];
  const changed = rows.filter((r) => r.status === 'CHANGED');
  const skipped = rows.filter((r) => r.status === 'NOT_FOUND' || r.status === 'INVALID' || r.status === 'DUPLICATE');
  const apply = useMenuAction(() => applyImport(pending.payload),
    (r) => `Updated ${r?.changed ?? 0} price${r?.changed === 1 ? '' : 's'}`, 'Import failed, nothing was changed');

  return (
    <Dialog id="menuImportModal" open onClose={onClose} size="lg" title="Review menu price changes"
      description={<>File: <span id="menuImportFileName" className="font-medium text-fg">{fileName}</span>. Only prices change; nothing is saved until you confirm.</>}>
      <div id="menuImportSummary" className="flex flex-wrap gap-2 text-sm mb-3">
        <Badge tone="info">{result.changed} price change{result.changed === 1 ? '' : 's'}</Badge>
        <Badge>{result.unchanged} unchanged</Badge>
        {skipped.length > 0 && <Badge tone="danger">{skipped.length} skipped</Badge>}
      </div>

      <div id="menuImportChanges">
        {changed.length === 0 ? (
          <p className="text-sm text-muted text-center py-6">No price changes found in this file.</p>
        ) : (
          <div className="rounded-lg border border-line divide-y divide-line">
            {changed.map((r) => {
              const diff = Number(r.newPrice) - Number(r.oldPrice);
              return (
                <div key={r.index} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-fg truncate">{r.name}</p>
                    <p className="text-xs text-muted break-words">{r.categoryName}{r.message ? <> · <span className="text-warn">{r.message}</span></> : null}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-faint line-through">{rupees(r.oldPrice ?? 0)}</p>
                    <p className="font-semibold text-fg">{rupees(r.newPrice ?? 0)}</p>
                  </div>
                  <p className={`w-16 text-right shrink-0 text-sm font-semibold ${diff > 0 ? 'text-ok' : 'text-danger'}`}>{diff > 0 ? '+' : '-'}{Math.abs(diff).toFixed(2)}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {skipped.length > 0 && (
        <div id="menuImportSkipped" className="mt-3 rounded-lg border border-danger/30 bg-danger/5">
          <p className="px-3 py-2 text-xs font-semibold text-danger">Skipped – these will not be changed</p>
          {skipped.map((r) => (
            <p key={r.index} className="px-3 py-1.5 border-t border-danger/15 text-xs text-muted">
              <span className="text-faint">#{r.index}</span> <span className="font-medium text-fg">{r.name || (r.id != null ? `id ${r.id}` : 'entry')}</span> – <span className="text-danger">{r.message || r.status}</span>
            </p>
          ))}
        </div>
      )}

      <div className="flex gap-2 mt-5">
        <button type="button" onClick={onClose} className="btn btn-secondary h-10">Cancel</button>
        <button type="button" id="btnConfirmMenuImport" disabled={changed.length === 0 || apply.isPending} onClick={() => apply.mutate(undefined, { onSuccess: onClose })} className="btn btn-primary flex-1 h-10">
          {apply.isPending ? 'Updating…' : changed.length === 0 ? 'Nothing to update' : `Confirm & update ${changed.length} price${changed.length === 1 ? '' : 's'}`}
        </button>
      </div>
    </Dialog>
  );
}
