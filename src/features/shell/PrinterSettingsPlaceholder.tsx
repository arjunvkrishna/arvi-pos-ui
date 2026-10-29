import { useUi } from '../../app/ui';
import { Dialog } from '../../components/Dialog';

/** Printer settings move to the new app in a later phase; until then this points to the classic app. */
export function PrinterSettingsPlaceholder() {
  const open = useUi((s) => s.printerSettingsOpen);
  const ui = useUi((s) => s.set);
  const close = () => ui({ printerSettingsOpen: false });
  return (
    <Dialog id="printerSettingsModal" open={open} onClose={close} size="sm" title="Printer settings"
      description="Printer and bridge settings have not moved to the new app yet.">
      <a href="/#bills" className="btn btn-primary w-full h-10">Open in the classic app</a>
    </Dialog>
  );
}
