import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { EmptyState, Field, Skeleton } from '../../components/ui';
import { Dialog } from '../../components/Dialog';
import { showToast } from '../../components/toast';
import { fetchCoupons, createCoupon, deleteCoupon } from './api';

export function CouponsTab() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    description: '',
    discountType: 'PERCENTAGE' as 'PERCENTAGE' | 'FIXED_AMOUNT',
    discountValue: '10',
    minOrderValue: '100',
    maxDiscountAmount: '50',
    usageLimit: '100',
    usageLimitPerCustomer: '1',
    validFrom: new Date().toISOString().split('T')[0],
    validUntil: '',
  });

  const couponsQ = useQuery({
    queryKey: ['coupons'],
    queryFn: fetchCoupons,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createCoupon({
        code: formData.code.trim().toUpperCase(),
        description: formData.description,
        discountType: formData.discountType,
        discountValue: Number(formData.discountValue),
        minOrderValue: Number(formData.minOrderValue) || 0,
        maxDiscountAmount: formData.maxDiscountAmount ? Number(formData.maxDiscountAmount) : undefined,
        usageLimit: formData.usageLimit ? Number(formData.usageLimit) : undefined,
        usageLimitPerCustomer: formData.usageLimitPerCustomer ? Number(formData.usageLimitPerCustomer) : 1,
        validFrom: new Date(formData.validFrom).toISOString(),
        validUntil: formData.validUntil ? new Date(formData.validUntil).toISOString() : null,
      }),
    onSuccess: () => {
      showToast('Coupon created successfully!', 'success');
      setCreateOpen(false);
      qc.invalidateQueries({ queryKey: ['coupons'] });
    },
    onError: (e: Error) => showToast(`Failed to create coupon: ${e.message}`, 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCoupon,
    onSuccess: () => {
      showToast('Coupon deleted', 'info');
      qc.invalidateQueries({ queryKey: ['coupons'] });
    },
  });

  const coupons = couponsQ.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-base font-semibold text-fg">Marketing Coupons</h3>
          <p className="text-xs text-muted">Promo codes with order limits, per-customer frequency, and validity windows.</p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="btn btn-primary"
        >
          <i className="fa-solid fa-plus mr-1" />
          Create Coupon
        </button>
      </div>

      <div className="card overflow-hidden">
        {couponsQ.isLoading ? (
          <div className="p-6"><Skeleton rows={4} /></div>
        ) : coupons.length === 0 ? (
          <EmptyState icon="fa-solid fa-ticket" title="No coupons active" hint="Create a coupon code for customer marketing campaigns." />
        ) : (
          <div className="overflow-x-auto">
            <table className="rtable">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Discount</th>
                  <th>Min Order</th>
                  <th>Usage</th>
                  <th>Validity</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((c) => (
                  <tr key={c.id} className="hover:bg-subtle">
                    <td data-label="" className="font-mono font-bold text-brand-text cell-title">
                      {c.code}
                      {c.description && <div className="text-xs font-normal text-muted">{c.description}</div>}
                    </td>
                    <td data-label="Discount" className="font-semibold text-fg">
                      {c.discountType === 'PERCENTAGE' ? `${c.discountValue}%` : `₹${c.discountValue}`}
                    </td>
                    <td data-label="Min Order" className="text-muted">₹{c.minOrderValue || 0}</td>
                    <td data-label="Usage" className="">
                      <span className="font-medium text-fg">{c.usedCount}</span>
                      {c.usageLimit ? <span className="text-muted"> / {c.usageLimit}</span> : <span className="text-muted"> (unlimited)</span>}
                    </td>
                    <td data-label="Validity" className="text-xs text-muted">
                      {new Date(c.validFrom).toLocaleDateString()}
                      {c.validUntil ? ` to ${new Date(c.validUntil).toLocaleDateString()}` : ' (no expiry)'}
                    </td>
                    <td data-label="Action" className="text-right cell-actions">
                      <button
                        type="button"
                        onClick={() => deleteMutation.mutate(c.id)}
                        className="btn btn-ghost btn-sm text-danger"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {createOpen && (
        <Dialog id="dialogNewCoupon" open={createOpen} onClose={() => setCreateOpen(false)} title="Create New Coupon">
          <div className="space-y-3">
            <Field id="couponCode" label="Coupon Code">
              <input
                id="couponCode"
                placeholder="e.g. WELCOME10"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                className="input uppercase"
              />
            </Field>
            <Field id="couponDesc" label="Description">
              <input
                id="couponDesc"
                placeholder="e.g. 10% off for new diners"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="input"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field id="couponType" label="Discount Type">
                <select
                  id="couponType"
                  value={formData.discountType}
                  onChange={(e) => setFormData({ ...formData, discountType: e.target.value as typeof formData.discountType })}
                  className="input"
                >
                  <option value="PERCENTAGE">Percentage (%)</option>
                  <option value="FIXED_AMOUNT">Fixed Amount (₹)</option>
                </select>
              </Field>
              <Field id="couponVal" label="Discount Value">
                <input
                  id="couponVal"
                  type="number"
                  value={formData.discountValue}
                  onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                  className="input"
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field id="minOrder" label="Min Order Value (₹)">
                <input
                  id="minOrder"
                  type="number"
                  value={formData.minOrderValue}
                  onChange={(e) => setFormData({ ...formData, minOrderValue: e.target.value })}
                  className="input"
                />
              </Field>
              <Field id="maxDisc" label="Max Cap Amount (₹)">
                <input
                  id="maxDisc"
                  type="number"
                  placeholder="Optional"
                  value={formData.maxDiscountAmount}
                  onChange={(e) => setFormData({ ...formData, maxDiscountAmount: e.target.value })}
                  className="input"
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field id="usageLimit" label="Total Usage Limit">
                <input
                  id="usageLimit"
                  type="number"
                  placeholder="Unlimited"
                  value={formData.usageLimit}
                  onChange={(e) => setFormData({ ...formData, usageLimit: e.target.value })}
                  className="input"
                />
              </Field>
              <Field id="custLimit" label="Per-Customer Limit">
                <input
                  id="custLimit"
                  type="number"
                  value={formData.usageLimitPerCustomer}
                  onChange={(e) => setFormData({ ...formData, usageLimitPerCustomer: e.target.value })}
                  className="input"
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field id="validFrom" label="Valid From">
                <input
                  id="validFrom"
                  type="date"
                  value={formData.validFrom}
                  onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                  className="input"
                />
              </Field>
              <Field id="validUntil" label="Valid Until">
                <input
                  id="validUntil"
                  type="date"
                  value={formData.validUntil}
                  onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                  className="input"
                />
              </Field>
            </div>
            <div className="flex justify-end gap-2 pt-3">
              <button type="button" onClick={() => setCreateOpen(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => createMutation.mutate()}
                disabled={!formData.code || createMutation.isPending}
                className="btn btn-primary"
              >
                Create Coupon
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
