import { useEffect, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog } from '../../components/Dialog';
import { showToast } from '../../components/toast';
import { Badge, EmptyState, Field, PageHeader, Skeleton } from '../../components/ui';
import { useSafeMutation as useMutation } from '../../lib/useSafeMutation';
import { fetchHistory, fetchPreview, fetchRecipients, fetchSettings, linkCode, saveSettings, sendNow, sendTest, setChatId, tgKey, toggleRecipient, unlink, type TgLink, type TgRecipient, type TgSettings } from './api';
import { linkInstructions, sanitizeReport } from './rules';

type Modal = { kind: 'link'; data: TgLink } | { kind: 'chat'; r: TgRecipient } | { kind: 'preview' } | null;

export function TelegramPage() {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: [...tgKey, 'settings'], queryFn: fetchSettings });
  const recipients = useQuery({ queryKey: [...tgKey, 'recipients'], queryFn: fetchRecipients });
  const preview = useQuery({ queryKey: [...tgKey, 'preview'], queryFn: fetchPreview });
  const history = useQuery({ queryKey: [...tgKey, 'history'], queryFn: fetchHistory });
  const [modal, setModal] = useState<Modal>(null);
  const close = () => { setModal(null); void qc.invalidateQueries({ queryKey: tgKey }); };
  const refresh = () => qc.invalidateQueries({ queryKey: tgKey });

  const err = settings.isError ? settings.error.message : recipients.isError ? recipients.error.message : '';
  useEffect(() => { if (err) showToast(`Failed to load Telegram settings: ${err}`, 'error'); }, [err]);

  const toggle = useMutation({ mutationFn: (v: { id: number; on: boolean }) => toggleRecipient(v.id, v.on), onSuccess: () => showToast('Recipient status updated', 'success'), onError: (e: Error) => { showToast(`Failed to update recipient: ${e.message}`, 'error'); void refresh(); } });
  const link = useMutation({ mutationFn: linkCode, onSuccess: (data) => setModal({ kind: 'link', data }), onError: (e: Error) => showToast(`Failed to generate link code: ${e.message}`, 'error') });
  const test = useMutation({ mutationFn: (id: number) => { showToast('Sending test message via Telegram...', 'info'); return sendTest(id); }, onSuccess: (r) => { showToast(r.message || 'Test message delivered successfully!', 'success'); void refresh(); }, onError: (e: Error) => showToast(`Test delivery failed: ${e.message}`, 'error') });
  const unlinkM = useMutation({ mutationFn: unlink, onSuccess: () => { showToast('Telegram account unlinked successfully', 'success'); void refresh(); }, onError: (e: Error) => showToast(`Failed to unlink account: ${e.message}`, 'error') });
  const dispatch = useMutation({ mutationFn: () => { showToast('Dispatching Telegram low-stock report...', 'info'); return sendNow(); }, onSuccess: (r) => { showToast(`Dispatch complete: Sent to ${r.sentCount} manager(s), ${r.failedCount} failed`, r.failedCount > 0 ? 'warning' : 'success'); void refresh(); }, onError: (e: Error) => showToast(`Failed to execute daily dispatch: ${e.message}`, 'error') });

  const s = settings.data;
  const list = recipients.data ?? [];
  const hist = (history.data ?? []).slice(0, 50);

  return (
    <section id="tab-telegram" data-testid="tab-telegram" className="space-y-5">
      <PageHeader title="Telegram alerts" description="Automated daily inventory alerts delivered to managers via Telegram."
        actions={<>
          {s && <span id="telegramGlobalStatusBadge"><Badge tone={s.enabled ? 'ok' : 'danger'} icon={s.enabled ? 'fa-circle-check' : 'fa-circle-xmark'}>{s.enabled ? `Active (${s.dailySendTime} IST)` : 'Disabled'}</Badge></span>}
          {s && <span id="telegramBotBadge"><Badge tone={s.botConfigured ? 'ok' : 'neutral'} icon="fa-robot">{s.botConfigured ? `Bot: ${s.botUsername ? `@${s.botUsername}` : 'Configured'}` : 'Bot: not configured (server .env)'}</Badge></span>}
        </>} />

      <div className="grid lg:grid-cols-3 gap-4">
        {s ? <SettingsCard key={s.dailySendTime + String(s.enabled)} s={s} onSaved={refresh} /> : <div className="card"><Skeleton rows={2} /></div>}
        <div className="card p-5 space-y-3"><h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Daily report</h2>
          <p className="text-sm text-muted" id="telegramLastRunDate">Last run: {s?.lastRunDate || 'Never'}</p>
          <div className="grid grid-cols-2 gap-3 text-center"><div className="rounded-lg bg-subtle p-3"><p id="telegramStatLowStockCount" className="text-2xl font-semibold text-danger">{preview.data?.itemCount ?? 0}</p><p className="text-xs text-muted">Low-stock items</p></div>
            <div className="rounded-lg bg-subtle p-3"><p id="telegramStatVerifiedCount" className="text-2xl font-semibold text-ok">{s?.verifiedRecipientsCount ?? 0}</p><p className="text-xs text-muted">Verified managers</p></div></div></div>
        <div className="card p-5 space-y-3"><h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Actions</h2>
          <button type="button" id="btnTelegramPreview" onClick={() => setModal({ kind: 'preview' })} className="btn btn-secondary w-full"><i className="fa-solid fa-eye" />Preview report</button>
          <button type="button" id="btnTelegramSendNow" disabled={dispatch.isPending} onClick={() => { if (window.confirm("Send today's low-stock summary immediately to all verified active managers?")) dispatch.mutate(undefined); }} className="btn btn-primary w-full"><i className="fa-solid fa-paper-plane" />Send now</button></div>
      </div>

      <div className="card overflow-hidden">
        <p className="px-4 py-3 border-b border-line text-sm font-medium text-fg">Manager recipients</p>
        {recipients.isPending ? <Skeleton rows={3} /> : list.length === 0 ? <EmptyState icon="fa-user-tie" title="No manager accounts found" hint="Create manager accounts in Staff & Payroll or User Accounts." /> : (
          <table className="rtable">
            <thead><tr><th>Manager</th><th className="text-center">Receive</th><th>Status</th><th>Chat ID</th><th>Last tested</th><th className="text-right">Actions</th></tr></thead>
            <tbody id="telegramRecipientsTableBody">{list.map((r) => {
              const verified = r.status === 'VERIFIED';
              const pending = r.status === 'PENDING_VERIFICATION';
              const tested = r.verifiedAt || r.lastTestSentAt;
              return (
                <tr key={r.userId}>
                  <td data-label="" className="cell-title"><span className="font-medium text-fg block">{r.employeeName || r.username}</span><span className="text-xs text-muted">@{r.username}{r.telegramUsername && <span className="text-info font-mono ml-1.5">(@{r.telegramUsername})</span>}</span></td>
                  <td data-label="Receive" className="md:text-center"><input type="checkbox" checked={r.selected} onChange={(e) => toggle.mutate({ id: r.userId, on: e.target.checked })} aria-label={`Send reports to ${r.employeeName || r.username}`} className="h-4 w-4 accent-[rgb(var(--brand))]" /></td>
                  <td data-label="Status">{verified ? <Badge tone="ok" icon="fa-circle-check">Verified</Badge> : pending ? <Badge tone="warn" icon="fa-clock-rotate-left">Pending verification</Badge> : <Badge>Not configured</Badge>}</td>
                  <td data-label="Chat ID"><span className="inline-flex items-center gap-1.5">{r.telegramChatIdMasked ? <code className="font-mono text-xs bg-subtle px-1.5 py-0.5 rounded">{r.telegramChatIdMasked}</code> : <span className="text-faint italic">None</span>}
                    <button type="button" onClick={() => setModal({ kind: 'chat', r })} title="Edit Chat ID" aria-label={`Edit chat ID of ${r.username}`} className="btn btn-ghost btn-icon btn-sm"><i className="fa-solid fa-pen text-xs" /></button></span></td>
                  <td data-label="Last tested" className="text-muted text-xs">{tested ? new Date(tested).toLocaleDateString() : '—'}</td>
                  <td className="cell-actions"><div className="flex flex-wrap items-center justify-end gap-1.5 w-full md:w-auto">
                    <button type="button" onClick={() => link.mutate(r.userId)} className="btn btn-soft-brand btn-sm"><i className="fa-solid fa-link" />Link account</button>
                    <button type="button" onClick={() => test.mutate(r.userId)} disabled={!verified} className="btn btn-secondary btn-sm"><i className="fa-solid fa-paper-plane" />Test</button>
                    {(verified || r.telegramChatId) && <button type="button" onClick={() => { if (window.confirm("Unlink this manager's Telegram account? They will no longer receive daily low-stock reports until linked again.")) unlinkM.mutate(r.userId); }} title="Unlink Telegram account" aria-label={`Unlink ${r.username}`} className="btn btn-soft-danger btn-icon btn-sm"><i className="fa-solid fa-link-slash" /></button>}
                  </div></td>
                </tr>);
            })}</tbody>
          </table>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-line flex items-center justify-between"><p className="text-sm font-medium text-fg">Delivery history</p>
          <button type="button" id="btnTelegramHistoryRefresh" onClick={async () => { await history.refetch(); showToast('Delivery history refreshed', 'success'); }} className="btn btn-ghost btn-sm"><i className="fa-solid fa-rotate" />Refresh history</button></div>
        {hist.length === 0 ? <EmptyState icon="fa-clock-rotate-left" title="No low-stock report logs recorded yet" /> : (
          <table className="rtable">
            <thead><tr><th>Sent at</th><th>Manager</th><th>Chat</th><th>Type</th><th>Status</th><th>Items</th><th>Details</th></tr></thead>
            <tbody id="telegramHistoryTableBody">{hist.map((h, i) => (
              <tr key={i}>
                <td data-label="" className="cell-title font-mono text-xs text-fg">{h.sentAt ? new Date(h.sentAt).toLocaleString() : h.reportDate}</td><td data-label="Manager" className="font-medium text-fg">{h.managerName || 'Manager'}</td>
                <td data-label="Chat" className="font-mono text-xs text-muted">{h.chatIdMasked || '—'}</td><td data-label="Type"><Badge tone={h.deliveryType === 'TEST_MESSAGE' ? 'info' : 'brand'}>{h.deliveryType === 'TEST_MESSAGE' ? 'TEST' : 'DAILY'}</Badge></td>
                <td data-label="Status"><Badge tone={h.status === 'SUCCESS' ? 'ok' : 'danger'}>{h.status === 'SUCCESS' ? 'SUCCESS' : 'FAILED'}</Badge></td><td data-label="Items">{h.itemsCount || 0}</td>
                <td data-label="Details" className="text-xs text-muted truncate max-w-[220px]" title={h.errorDescription || 'Delivered successfully'}>{h.errorDescription || 'Delivered successfully'}</td>
              </tr>))}</tbody>
          </table>
        )}
      </div>

      {modal?.kind === 'link' && <LinkDialog data={modal.data} onClose={close} />}
      {modal?.kind === 'chat' && <ChatIdDialog r={modal.r} onClose={close} />}
      {modal?.kind === 'preview' && <PreviewDialog settings={s} onClose={() => setModal(null)} />}
    </section>
  );
}

function SettingsCard({ s, onSaved }: { s: TgSettings; onSaved: () => void }) {
  const [enabled, setEnabled] = useState(Boolean(s.enabled));
  const [time, setTime] = useState(s.dailySendTime || '09:00');
  const save = useMutation({ mutationFn: () => saveSettings(enabled, time), onSuccess: () => { showToast('Telegram settings saved successfully', 'success'); onSaved(); }, onError: (e: Error) => { setEnabled(Boolean(s.enabled)); showToast(e.message || 'Failed to save Telegram settings', 'error'); } });
  return (
    <div className="card p-5 space-y-4"><h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Daily low-stock report</h2>
      <label htmlFor="telegramEnabledToggle" className="flex items-center justify-between gap-3 cursor-pointer"><span className="text-sm font-medium text-fg">Send the daily report</span>
        <input id="telegramEnabledToggle" type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-5 w-5 accent-[rgb(var(--brand))]" /></label>
      <Field id="telegramSendTimeInput" label="Daily send time" hint="Default: 09:00 AM Indian Standard Time"><input id="telegramSendTimeInput" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="input w-40" /></Field>
      <button type="button" id="btnSaveTelegram" onClick={() => save.mutate(undefined)} disabled={save.isPending} className="btn btn-primary w-full"><i className="fa-solid fa-floppy-disk" />{save.isPending ? 'Saving…' : 'Save configuration'}</button>
    </div>
  );
}

function LinkDialog({ data, onClose }: { data: TgLink; onClose: () => void }) {
  const bot = data.botUsername ? `@${data.botUsername}` : 'your ARVI Bot';
  const href = data.deepLink || (data.botUsername ? `https://t.me/${data.botUsername}?start=${data.linkCode}` : '#');
  const copy = async () => { try { await navigator.clipboard.writeText(linkInstructions(data.botUsername, data.linkCode)); showToast('Linking instructions copied to clipboard!', 'success'); } catch { showToast(`Link code: ${data.linkCode}`, 'info'); } };
  return (
    <Dialog id="telegramLinkModal" open onClose={onClose} size="md" title="Link Telegram account" description={<span id="telegramLinkModalSubtitle">Manager: {data.managerName} (@{data.username})</span>}>
      <div className="space-y-4">
        <div className="rounded-xl bg-brand/10 p-4 text-center"><p className="text-xs text-muted">Your link code (valid for 15 minutes)</p><p id="telegramModalLinkCode" className="text-3xl font-semibold tracking-widest text-fg mt-1">{data.linkCode}</p></div>
        <ol className="list-decimal pl-5 text-sm text-fg space-y-1.5"><li>Open Telegram on your phone or computer.</li><li>Search for <strong id="telegramModalBotTag">{bot}</strong>.</li><li>Send the command <code id="telegramModalCommandCode" className="bg-subtle px-1.5 py-0.5 rounded">/link {data.linkCode}</code></li><li>The bot verifies and links the account instantly.</li></ol>
        <div className="flex flex-wrap gap-2"><a id="telegramModalDirectLink" href={href} target="_blank" rel="noreferrer" className="btn btn-primary flex-1"><i className="fa-brands fa-telegram" />Open in Telegram</a>
          <button type="button" onClick={copy} className="btn btn-secondary"><i className="fa-regular fa-copy" />Copy instructions</button></div>
      </div>
    </Dialog>
  );
}

function ChatIdDialog({ r, onClose }: { r: TgRecipient; onClose: () => void }) {
  const [chatId, setChat] = useState(r.telegramChatId || '');
  const save = useMutation({ mutationFn: () => setChatId(r.userId, chatId.trim()), onSuccess: () => { showToast('Telegram Chat ID saved successfully', 'success'); onClose(); }, onError: (e: Error) => showToast(`Failed to update Chat ID: ${e.message}`, 'error') });
  const submit = (e: FormEvent) => { e.preventDefault(); if (!chatId.trim()) { showToast('Please enter a valid Telegram Chat ID', 'error'); return; } save.mutate(undefined); };
  return (
    <Dialog id="telegramChatIdModal" open onClose={onClose} size="sm" title="Edit Telegram chat ID" description={<span id="telegramChatIdModalManagerName">{r.employeeName || r.username}</span>}>
      <form onSubmit={submit} className="space-y-4">
        <Field id="telegramChatIdInput" label="Telegram destination chat ID" hint="The chat ID identifies the recipient's Telegram conversation."><input id="telegramChatIdInput" value={chatId} onChange={(e) => setChat(e.target.value)} className="input font-mono" placeholder="e.g. 123456789" autoFocus /></Field>
        <button type="submit" id="btnSaveChatId" disabled={save.isPending} className="btn btn-primary w-full h-10">{save.isPending ? 'Saving…' : 'Save chat ID'}</button>
      </form>
    </Dialog>
  );
}

function PreviewDialog({ settings, onClose }: { settings?: TgSettings; onClose: () => void }) {
  const q = useQuery({ queryKey: [...tgKey, 'preview-live'], queryFn: fetchPreview, staleTime: 0 });
  return (
    <Dialog id="telegramPreviewModal" open onClose={onClose} size="md" title="Daily low-stock report preview" description="How the Telegram message will look.">
      {q.isPending ? <Skeleton rows={4} /> : (
        <div className="space-y-3">
          <Badge tone="warn"><span id="previewItemCountBadge">{q.data?.itemCount ?? 0} low-stock item(s)</span></Badge>
          <div className="rounded-xl bg-subtle p-4">
            <div className="flex justify-between text-xs text-muted mb-2"><span id="previewBotSender" className="font-medium text-info">{settings?.botUsername ? `@${settings.botUsername}` : 'ARVI POS Bot'}</span><span id="previewMessageTime">{settings?.dailySendTime ? `${settings.dailySendTime} IST` : '09:00 AM'}</span></div>
            {q.data?.formattedReport
              ? <div id="telegramPreviewReportContent" className="text-sm text-fg whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{ __html: sanitizeReport(q.data.formattedReport) }} />
              : <div id="telegramPreviewReportContent" className="text-sm text-muted">No report available</div>}
          </div>
        </div>
      )}
    </Dialog>
  );
}
