import { Dialog } from '../../components/Dialog';
import { showToast } from '../../components/toast';
import { isIosDevice, promptInstall, usePwa } from './pwa';

/** How to put ARVI POS on the home screen: one tap when the browser offers it, otherwise the steps for the device. */
export function PwaInstallDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const offer = usePwa((s) => s.offer);
  const ios = isIosDevice(navigator.userAgent, 'MSStream' in window);
  const install = async () => {
    const ok = await promptInstall();
    onClose();
    if (ok) showToast('ARVI POS app installed successfully!', 'success');
    else showToast('Follow the browser instructions to install the app', 'info');
  };
  return (
    <Dialog id="pwaInstallModal" open={open} onClose={onClose} size="md" title="Install ARVI POS" description="Open it like an app: full screen, its own icon, and it keeps working on a weak connection.">
      <div className="space-y-4">
        {offer && (
          <div id="pwaDirectInstallSection" className="rounded-xl bg-brand/10 border border-brand/30 p-4 flex items-center justify-between gap-3">
            <p className="text-sm text-fg font-medium">Your browser can install it in one tap.</p>
            <button type="button" id="btnPwaInstallNow" onClick={install} className="btn btn-primary shrink-0"><i className="fa-solid fa-download" />Install</button>
          </div>
        )}
        {ios ? (
          <section id="pwaIosGuideSection" className="space-y-2 text-sm">
            <h3 className="font-semibold text-fg"><i className="fa-brands fa-apple mr-1.5" />iPhone / iPad (Safari)</h3>
            <ol className="list-decimal pl-5 space-y-1 text-muted"><li>Tap the <b className="text-fg">Share</b> button in Safari's toolbar.</li><li>Choose <b className="text-fg">Add to Home Screen</b>.</li><li>Tap <b className="text-fg">Add</b>. ARVI POS now opens from your home screen.</li></ol>
          </section>
        ) : (
          <section id="pwaAndroidGuideSection" className="space-y-2 text-sm">
            <h3 className="font-semibold text-fg"><i className="fa-brands fa-chrome mr-1.5" />Android, Chrome or Edge on a computer</h3>
            <ol className="list-decimal pl-5 space-y-1 text-muted"><li>Open the browser menu (<b className="text-fg">⋮</b>).</li><li>Choose <b className="text-fg">Install app</b> (or <b className="text-fg">Add to Home screen</b>).</li><li>Confirm. ARVI POS now opens like an app.</li></ol>
          </section>
        )}
        <div className="flex justify-end"><button type="button" onClick={onClose} className="btn btn-secondary">Close</button></div>
      </div>
    </Dialog>
  );
}
