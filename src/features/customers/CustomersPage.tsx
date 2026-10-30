import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hasFeature } from '../../api/roles';
import { useSession } from '../../api/session';
import { Badge, EmptyState, PageHeader, SearchInput, SegmentedTabs, Skeleton, Field } from '../../components/ui';
import { Dialog } from '../../components/Dialog';
import { showToast } from '../../components/toast';
import {
  fetchCustomers,
  createCustomer,
  updateCustomer,
  fetchLoyaltyLedger,
  customersKey,
  type Customer,
  type CustomerInput,
} from './api';
import { CampaignsTab } from './CampaignsTab';
import { LoyaltyRulesBar } from './LoyaltyRules';
import { ExpiryChip } from './ExpiryChip';

export function CustomersPage() {
  const qc = useQueryClient();
  const campaignsInPlan = useSession((u) => (u.user ? hasFeature(u.user, 'CAMPAIGNS') : true));   // marketing campaigns are an ENTERPRISE module
  const [tab, setTab] = useState<'customers' | 'campaigns'>('customers');
  const [query, setQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Queries
  const customersQ = useQuery({
    queryKey: [...customersKey, query],
    queryFn: () => fetchCustomers(query),
  });

  const loyaltyQ = useQuery({
    queryKey: ['loyalty', selectedCustomerId],
    queryFn: () => (selectedCustomerId ? fetchLoyaltyLedger(selectedCustomerId) : Promise.resolve([])),
    enabled: !!selectedCustomerId,
  });

  const customers = useMemo(() => customersQ.data ?? [], [customersQ.data]);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) ?? null,
    [customers, selectedCustomerId]
  );

  // Metrics
  const totalPoints = useMemo(
    () => customers.reduce((sum, c) => sum + (c.pointsBalance || 0), 0),
    [customers]
  );

  return (
    <section id="tab-customers" data-testid="tab-customers" className="space-y-4">
      <PageHeader
        title="Customer CRM & Loyalty"
        description="Manage customer loyalty points, dietary preferences and DPDP compliance."
        actions={
          <div className="flex gap-2">
            <button
              type="button"
              id="btnNewCustomer"
              onClick={() => {
                setEditingCustomer(null);
                setEditDialogOpen(true);
              }}
              className="btn btn-primary"
            >
              <i className="fa-solid fa-user-plus mr-1" />
              New Customer
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        <div className="card p-3.5 space-y-1">
          <span className="text-xs uppercase tracking-wider text-muted font-medium">Total Customers</span>
          <p className="text-2xl font-bold text-fg">{customers.length}</p>
        </div>
        <div className="card p-3.5 space-y-1">
          <span className="text-xs uppercase tracking-wider text-muted font-medium">Loyalty Pool</span>
          <p className="text-2xl font-bold text-amber-500">⭐ {totalPoints.toLocaleString()} pts</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <SegmentedTabs
          label="View mode"
          value={tab}
          onChange={(v) => setTab(v as typeof tab)}
          options={[
            { value: 'customers', label: `Customers (${customers.length})`, id: 'tabModeCustomers' },
            ...(campaignsInPlan ? [{ value: 'campaigns' as const, label: 'Campaigns', id: 'tabModeCampaigns' }] : []),
          ]}
        />
        {tab === 'customers' && (
          <div className="w-full sm:w-72">
            <SearchInput
              id="customerSearchInput"
              value={query}
              onChange={setQuery}
              placeholder="Search by name, phone, email..."
            />
          </div>
        )}
      </div>

      {tab === 'customers' && <LoyaltyRulesBar />}

      {tab === 'customers' && (
        <div className="card overflow-hidden">
          {customersQ.isLoading ? (
            <div className="p-6">
              <Skeleton rows={6} />
            </div>
          ) : customers.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon="fa-solid fa-users"
                title="No customers found"
                hint={query ? 'No customer matches your search.' : 'Add your first customer to start tracking loyalty.'}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="rtable">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Contact</th>
                    <th>Loyalty Points</th>
                    <th>DPDP Consent</th>
                    <th>Allergies / Notes</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c.id} className="hover:bg-subtle/50 transition">
                      <td data-label="" className="cell-title">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-brand/15 text-brand-text flex items-center justify-center font-bold text-xs shrink-0">
                            {c.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-semibold text-fg block">{c.name}</span>
                            {c.birthday && (
                              <span className="text-[11px] text-muted">
                                <i className="fa-solid fa-cake-candles mr-1 text-pink-500" />
                                {c.birthday}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td data-label="Phone" className="">
                        <span className="font-mono text-fg text-xs block">{c.phone}</span>
                        {c.email && <span className="text-xs text-muted block">{c.email}</span>}
                      </td>
                      <td data-label="Loyalty" className="">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold text-xs bg-amber-500/10 text-amber-600 border border-amber-500/20">
                          <i className="fa-solid fa-star text-[10px]" />
                          {c.pointsBalance} pts (₹{c.pointsBalance})
                        </span>
                        <span className="block mt-1"><ExpiryChip customer={c} /></span>
                      </td>
                      <td data-label="Promotions" className="">
                        {c.marketingConsent ? (
                          <Badge tone="ok">CONSENTED</Badge>
                        ) : (
                          <Badge tone="neutral">NO PROMOS</Badge>
                        )}
                      </td>
                      <td data-label="Notes" className="max-w-xs">
                        {c.allergies ? (
                          <span className="text-xs text-danger font-medium block truncate" title={c.allergies}>
                            <i className="fa-solid fa-triangle-exclamation mr-1" />
                            {c.allergies}
                          </span>
                        ) : null}
                        {c.notes ? (
                          <span className="text-xs text-muted truncate block" title={c.notes}>
                            {c.notes}
                          </span>
                        ) : !c.allergies ? (
                          <span className="text-xs text-muted">—</span>
                        ) : null}
                      </td>
                      <td data-label="" className="text-right space-x-1.5 whitespace-nowrap cell-actions">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCustomerId(c.id);
                            setCustomerModalOpen(true);
                          }}
                          className="btn btn-ghost btn-sm"
                          title="View loyalty ledger"
                        >
                          <i className="fa-solid fa-clock-rotate-left mr-1" />
                          History
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCustomer(c);
                            setEditDialogOpen(true);
                          }}
                          className="btn btn-ghost btn-sm"
                          title="Edit details"
                        >
                          <i className="fa-solid fa-pen-to-square" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'campaigns' && campaignsInPlan && <CampaignsTab />}

      {/* Customer Detail & Loyalty History Modal */}
      {customerModalOpen && selectedCustomer && (
        <Dialog
          id="customerDetailModal"
          open
          onClose={() => setCustomerModalOpen(false)}
          size="lg"
          title={`${selectedCustomer.name} - Profile & Loyalty`}
          description="Detailed loyalty points earning and redemption history."
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-subtle border border-line text-xs">
              <div>
                <span className="text-muted block">Phone</span>
                <span className="font-mono font-medium text-fg">{selectedCustomer.phone}</span>
              </div>
              <div>
                <span className="text-muted block">Current Points</span>
                <span className="font-bold text-amber-500 text-sm">⭐ {selectedCustomer.pointsBalance} pts</span>
              </div>
              <div>
                <span className="text-muted block">Points valid</span>
                <ExpiryChip customer={selectedCustomer} />
                {!selectedCustomer.pointsExpireAt && <span>—</span>}
              </div>
              <div>
                <span className="text-muted block">Marketing Consent</span>
                <span>{selectedCustomer.marketingConsent ? 'Opted In' : 'Opted Out'}</span>
              </div>
              <div>
                <span className="text-muted block">Birthday</span>
                <span>{selectedCustomer.birthday || '—'}</span>
              </div>
            </div>

            {selectedCustomer.allergies && (
              <div className="p-3 rounded-lg bg-danger/10 border border-danger/20 text-xs text-danger flex items-start gap-2">
                <i className="fa-solid fa-triangle-exclamation mt-0.5" />
                <div>
                  <strong>Allergies / Special Dietary Needs:</strong> {selectedCustomer.allergies}
                </div>
              </div>
            )}

            <div>
              <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                Loyalty Ledger Transactions
              </h4>
              {loyaltyQ.isLoading ? (
                <Skeleton rows={4} />
              ) : (loyaltyQ.data ?? []).length === 0 ? (
                <p className="text-sm text-muted py-6 text-center">No points transactions recorded yet.</p>
              ) : (
                <div className="border border-line rounded-lg overflow-hidden max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-subtle border-b border-line text-muted">
                      <tr>
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Action</th>
                        <th className="px-3 py-2">Points</th>
                        <th className="px-3 py-2">Balance After</th>
                        <th className="px-3 py-2">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {(loyaltyQ.data ?? []).map((l) => (
                        <tr key={l.id}>
                          <td className="px-3 py-2 text-muted whitespace-nowrap">
                            {new Date(l.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-3 py-2">
                            <Badge
                              tone={
                                l.type === 'EARN'
                                  ? 'ok'
                                  : l.type === 'REDEEM'
                                  ? 'warn'
                                  : 'danger'
                              }
                            >
                              {l.type}
                            </Badge>
                          </td>
                          <td className={`px-3 py-2 font-bold ${l.points > 0 ? 'text-ok' : 'text-danger'}`}>
                            {l.points > 0 ? `+${l.points}` : l.points}
                          </td>
                          <td className="px-3 py-2 font-semibold text-fg">{l.balanceAfter}</td>
                          <td className="px-3 py-2 text-muted">{l.note || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setCustomerModalOpen(false)}
                className="btn btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Add / Edit Customer Dialog */}
      {editDialogOpen && (
        <CustomerEditDialog
          customer={editingCustomer}
          onClose={() => setEditDialogOpen(false)}
          onSuccess={() => {
            setEditDialogOpen(false);
            void qc.invalidateQueries({ queryKey: customersKey });
          }}
        />
      )}

    </section>
  );
}

function CustomerEditDialog({
  customer,
  onClose,
  onSuccess,
}: {
  customer: Customer | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(customer?.name || '');
  const [phone, setPhone] = useState(customer?.phone || '');
  const [email, setEmail] = useState(customer?.email || '');
  const [birthday, setBirthday] = useState(customer?.birthday || '');
  const [anniversary, setAnniversary] = useState(customer?.anniversary || '');
  const [address, setAddress] = useState(customer?.address || '');
  const [allergies, setAllergies] = useState(customer?.allergies || '');
  const [notes, setNotes] = useState(customer?.notes || '');
  const [marketingConsent, setMarketingConsent] = useState(customer?.marketingConsent ?? true);

  const mutation = useMutation({
    mutationFn: (data: CustomerInput) => {
      if (customer) {
        return updateCustomer(customer.id, data);
      }
      return createCustomer(data);
    },
    onSuccess: () => {
      showToast(customer ? 'Customer updated' : 'Customer created', 'success');
      onSuccess();
    },
    onError: (err: Error) => {
      showToast(err.message || 'Failed to save customer', 'error');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      showToast('Name and phone number are required', 'warning');
      return;
    }
    mutation.mutate({
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      birthday: birthday || undefined,
      anniversary: anniversary || undefined,
      address: address.trim() || undefined,
      allergies: allergies.trim() || undefined,
      notes: notes.trim() || undefined,
      marketingConsent,
    });
  };

  return (
    <Dialog
      id="customerEditModal"
      open
      onClose={onClose}
      size="md"
      title={customer ? `Edit ${customer.name}` : 'New Customer'}
      description="Record customer details and communication preferences under DPDP regulations."
    >
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div className="grid grid-cols-2 gap-3">
          <Field id="custName" label="Full Name *">
            <input
              id="custName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              placeholder="e.g. Rahul Sharma"
              required
            />
          </Field>
          <Field id="custPhone" label="Phone (10 digits / E.164) *">
            <input
              id="custPhone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input font-mono"
              placeholder="e.g. 9876543210"
              required
            />
          </Field>
        </div>

        <Field id="custEmail" label="Email Address">
          <input
            id="custEmail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            placeholder="e.g. rahul@example.com"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field id="custBirthday" label="Birthday">
            <input
              id="custBirthday"
              type="date"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
              className="input"
            />
          </Field>
          <Field id="custAnniversary" label="Anniversary">
            <input
              id="custAnniversary"
              type="date"
              value={anniversary}
              onChange={(e) => setAnniversary(e.target.value)}
              className="input"
            />
          </Field>
        </div>

        <Field id="custAddress" label="Address">
          <input
            id="custAddress"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="input"
            placeholder="e.g. 123 Park Street, Bangalore"
          />
        </Field>

        <Field id="custAllergies" label="Allergies / Special Dietary Needs" hint="e.g. Peanuts, Gluten, Dairy-free, Jain">
          <input
            id="custAllergies"
            value={allergies}
            onChange={(e) => setAllergies(e.target.value)}
            className="input"
            placeholder="e.g. Nut allergy, lactose intolerant"
          />
        </Field>

        <Field id="custNotes" label="Customer Notes">
          <textarea
            id="custNotes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="input min-h-[60px]"
            placeholder="e.g. Regular corner table guest, prefers hot tea"
          />
        </Field>

        <label className="flex items-start gap-2.5 p-3 rounded-lg bg-subtle border border-line text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={marketingConsent}
            onChange={(e) => setMarketingConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded accent-brand"
          />
          <span className="text-fg leading-relaxed">
            <strong>DPDP Marketing Consent:</strong> Customer has consented to receive promotional SMS/WhatsApp alerts for discounts and campaigns.
          </span>
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={mutation.isPending} className="btn btn-primary">
            {mutation.isPending ? 'Saving...' : customer ? 'Save Changes' : 'Create Customer'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
