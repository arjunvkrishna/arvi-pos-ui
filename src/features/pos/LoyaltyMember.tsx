import { useState } from 'react';
import { Badge } from '../../components/ui';
import { showToast } from '../../components/toast';
import { createCustomer, findCustomerByPhone, type Customer } from '../customers/api';
import { ExpiryChip } from '../customers/ExpiryChip';

const digitsOf = (s: string) => s.replace(/\D/g, '');

/**
 * Pick the loyalty member for a bill by phone number. Points are only added when a customer is picked, so this is where
 * the customer gives their number; a new number can be added on the spot.
 */
export function LoyaltyMember({ customer, onChange }: { customer: Customer | null; onChange: (c: Customer | null) => void }) {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);

  const find = async () => {
    if (digitsOf(phone).length < 10) return showToast('Enter the customer\'s 10-digit phone number.', 'warning');
    setBusy(true);
    try {
      const found = await findCustomerByPhone(phone);
      if (found) { onChange(found); setMissing(false); } else { setMissing(true); }
    } catch (e) {
      showToast((e as Error).message || 'Could not look the customer up.', 'error');
    } finally { setBusy(false); }
  };

  const add = async () => {
    if (!name.trim()) return showToast('Enter the customer\'s name.', 'warning');
    setBusy(true);
    try {
      const created = await createCustomer({ name: name.trim(), phone: phone.trim(), marketingConsent: false });
      onChange(created);
      setMissing(false); setName('');
      showToast(`${created.name} joined the loyalty program.`, 'success');
    } catch (e) {
      showToast((e as Error).message || 'Could not add the customer.', 'error');
    } finally { setBusy(false); }
  };

  if (customer) {
    return (
      <div id="loyaltyMemberCard" className="rounded-xl border border-line bg-subtle/50 p-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm min-w-0">
          <p className="font-semibold text-fg truncate"><i className="fa-solid fa-star text-amber-500 mr-1.5" />{customer.name} <span className="font-mono text-xs text-muted">{customer.phone}</span></p>
          <p className="flex flex-wrap items-center gap-1.5 mt-1">
            <Badge tone="ok">{customer.pointsBalance} pts</Badge>
            <ExpiryChip customer={customer} />
          </p>
        </div>
        <button type="button" id="btnChangeMember" onClick={() => { onChange(null); setPhone(''); setMissing(false); }} className="text-xs font-medium text-muted hover:text-fg">Change</button>
      </div>
    );
  }

  return (
    <div id="loyaltyMemberLookup" className="rounded-xl border border-line bg-subtle/50 p-3 space-y-2">
      <label htmlFor="loyaltyPhone" className="label"><i className="fa-solid fa-star text-amber-500 mr-1.5" />Points: customer's phone number</label>
      <div className="flex items-center gap-2">
        <input id="loyaltyPhone" type="tel" inputMode="numeric" autoComplete="off" value={phone}
          onChange={(e) => { setPhone(e.target.value); setMissing(false); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void find(); } }}
          placeholder="e.g. 9876543210" className="input flex-1 font-mono" />
        <button type="button" id="btnFindMember" onClick={() => void find()} disabled={busy} className="btn btn-secondary btn-sm shrink-0">Find</button>
      </div>
      {missing ? (
        <div className="space-y-2">
          <p className="text-xs text-muted">No member with this number yet. Add them to start earning points.</p>
          <div className="flex items-center gap-2">
            <input id="loyaltyName" value={name} onChange={(e) => setName(e.target.value)} placeholder="Customer name" className="input flex-1" />
            <button type="button" id="btnAddMember" onClick={() => void add()} disabled={busy} className="btn btn-primary btn-sm shrink-0">Add member</button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted">₹100 = 1 point. Points are added only when the customer gives a phone number; leave this empty for no points.</p>
      )}
    </div>
  );
}
