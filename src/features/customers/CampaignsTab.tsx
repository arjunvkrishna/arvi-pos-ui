import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge, EmptyState, Field, Skeleton } from '../../components/ui';
import { Dialog } from '../../components/Dialog';
import { showToast } from '../../components/toast';
import { fetchCampaigns, createCampaign, sendCampaign, fetchAudienceCount } from './api';

export function CampaignsTab() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    message: '',
    channel: 'EMAIL' as 'EMAIL' | 'SMS',
    audienceType: 'ALL' as 'ALL' | 'LOYALTY_MEMBERS' | 'INACTIVE_30_DAYS',
  });

  const campaignsQ = useQuery({
    queryKey: ['campaigns'],
    queryFn: fetchCampaigns,
  });

  const audienceCountQ = useQuery({
    queryKey: ['campaign-audience-count', formData.audienceType],
    queryFn: () => fetchAudienceCount(formData.audienceType),
    enabled: createOpen,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createCampaign({
        name: formData.name.trim(),
        message: formData.message.trim(),
        channel: formData.channel,
        audienceType: formData.audienceType,
      }),
    onSuccess: () => {
      showToast('Campaign drafted successfully!', 'success');
      setCreateOpen(false);
      qc.invalidateQueries({ queryKey: ['campaigns'] });
    },
    onError: (e: Error) => showToast(`Failed to create campaign: ${e.message}`, 'error'),
  });

  const sendMutation = useMutation({
    mutationFn: (id: number) => sendCampaign(id),
    onSuccess: (res) => {
      showToast(`Campaign recorded for ${res.sentCount} opted-in customer(s). Nothing is emailed or texted automatically.`, 'success');
      qc.invalidateQueries({ queryKey: ['campaigns'] });
    },
    onError: (e: Error) => showToast(`Could not record the campaign: ${e.message}`, 'error'),
  });

  const campaigns = campaignsQ.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-base font-semibold text-fg">Marketing Campaigns</h3>
          <p className="text-xs text-muted">Audience-targeted campaigns that respect DPDP marketing consent. No email or SMS provider is connected: "Mark as sent" records the campaign and its audience, and you send the message through your own channel.</p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="btn btn-primary"
        >
          <i className="fa-solid fa-bullhorn mr-1" />
          New Campaign
        </button>
      </div>

      <div className="card overflow-hidden">
        {campaignsQ.isLoading ? (
          <div className="p-6"><Skeleton rows={4} /></div>
        ) : campaigns.length === 0 ? (
          <EmptyState icon="fa-solid fa-paper-plane" title="No campaigns yet" hint="Create an outbound marketing campaign for your diners." />
        ) : (
          <div className="divide-y divide-line">
            {campaigns.map((c) => (
              <div key={c.id} className="p-4 flex flex-wrap items-center justify-between gap-4 hover:bg-subtle transition">
                <div className="space-y-1 max-w-xl">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-fg text-sm">{c.name}</span>
                    <Badge tone={c.status === 'SENT' ? 'ok' : 'neutral'}>{c.status}</Badge>
                    <Badge tone="info">{c.channel}</Badge>
                    <Badge tone="warn">{c.audienceType.replace('_', ' ')}</Badge>
                  </div>
                  <p className="text-xs text-muted font-mono whitespace-pre-wrap">{c.message}</p>
                  <div className="text-[11px] text-muted flex gap-4 pt-1">
                    <span>Created: {new Date(c.createdAt).toLocaleDateString()}</span>
                    {c.sentAt && <span>Marked sent: {new Date(c.sentAt).toLocaleString()}</span>}
                    {c.sentCount > 0 && <span className="font-medium text-ok">Recorded for {c.sentCount} recipients</span>}
                  </div>
                </div>

                <div>
                  {c.status !== 'SENT' && (
                    <button
                      type="button"
                      onClick={() => sendMutation.mutate(c.id)}
                      disabled={sendMutation.isPending}
                      className="btn btn-primary btn-sm"
                    >
                      <i className="fa-solid fa-paper-plane mr-1" />
                      Mark as sent
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {createOpen && (
        <Dialog id="dialogNewCampaign" open={createOpen} onClose={() => setCreateOpen(false)} title="New Marketing Campaign">
          <div className="space-y-3">
            <Field id="campName" label="Campaign Name">
              <input
                id="campName"
                placeholder="e.g. Weekend Special Dinner Discount"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field id="campChannel" label="Channel">
                <select
                  id="campChannel"
                  value={formData.channel}
                  onChange={(e) => setFormData({ ...formData, channel: e.target.value as typeof formData.channel })}
                  className="input"
                >
                  <option value="EMAIL">Email</option>
                  <option value="SMS">SMS / WhatsApp</option>
                </select>
              </Field>

              <Field id="campAudience" label="Target Audience">
                <select
                  id="campAudience"
                  value={formData.audienceType}
                  onChange={(e) => setFormData({ ...formData, audienceType: e.target.value as typeof formData.audienceType })}
                  className="input"
                >
                  <option value="ALL">All Consented Diners</option>
                  <option value="LOYALTY_MEMBERS">Loyalty Members (with points)</option>
                  <option value="INACTIVE_30_DAYS">Inactive Diners (30+ days)</option>
                </select>
              </Field>
            </div>

            <div className="p-2.5 rounded-lg bg-subtle text-xs text-muted flex items-center justify-between">
              <span>Eligible Diners with DPDP Consent:</span>
              <span className="font-bold text-fg">
                {audienceCountQ.isLoading ? 'Checking...' : `${audienceCountQ.data?.eligibleCount || 0} customers`}
              </span>
            </div>

            <Field id="campMsg" label="Message Body">
              <textarea
                id="campMsg"
                rows={4}
                placeholder="Dear customer, enjoy 10% off this weekend with code WEEKEND10! To opt out, visit {{unsubscribe_url}}"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="input font-mono text-xs"
              />
            </Field>

            <div className="flex justify-end gap-2 pt-3">
              <button type="button" onClick={() => setCreateOpen(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => createMutation.mutate()}
                disabled={!formData.name || !formData.message || createMutation.isPending}
                className="btn btn-primary"
              >
                Create Campaign
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
