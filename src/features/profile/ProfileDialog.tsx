import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useUi } from '../../app/ui';
import { Dialog } from '../../components/Dialog';
import { Badge, Skeleton } from '../../components/ui';
import { fetchProfile } from '../attendance/api';
import { roleTone } from '../staff/rules';
import { initialsOf, niceDate, rupees } from './format';

/** One line of a card: a short label, then the value. A missing value says so instead of leaving a stray dash. */
function Row({ label, id, mono, children }: { label: string; id: string; mono?: boolean; children?: ReactNode }) {
  const empty = children === null || children === undefined || children === '';
  return (
    <div className="grid grid-cols-[6.75rem_minmax(0,1fr)] sm:grid-cols-[8.5rem_minmax(0,1fr)] gap-x-3 py-2.5 text-sm items-baseline">
      <dt className="text-muted leading-5">{label}</dt>
      <dd id={id} className={`min-w-0 text-fg leading-5 [overflow-wrap:anywhere] ${mono ? 'font-mono text-[13px]' : ''}`}>
        {empty ? <span className="text-faint">Not set</span> : children}
      </dd>
    </div>
  );
}

const perm = (on?: boolean) => on
  ? <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-ok/10 px-2 py-0.5 text-xs font-semibold text-ok"><i className="fa-solid fa-check text-[10px]" />Allowed</span>
  : <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-subtle px-2 py-0.5 text-xs font-semibold text-muted"><i className="fa-solid fa-xmark text-[10px]" />Restricted</span>;

function Section({ icon, title, className = '', children }: { icon: string; title: string; className?: string; children: ReactNode }) {
  return (
    <section className={`card p-4 ${className}`}>
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted pb-1">
        <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-md bg-brand/15 text-brand-text"><i className={`fa-solid ${icon} text-[11px]`} /></span>{title}
      </h3>
      <dl className="divide-y divide-line">{children}</dl>
    </section>
  );
}

/** "My profile & bank details": the signed-in user's account, employment and payout details (read-only). */
export function ProfileDialog() {
  const open = useUi((s) => s.profileOpen);
  const ui = useUi((s) => s.set);
  const q = useQuery({ queryKey: ['my-profile'], queryFn: fetchProfile, enabled: open, staleTime: 0 });
  const p = q.data;
  const name = p?.employeeName || p?.username || 'My profile';
  // the designation is often just the person's own title: do not say the name twice
  const sub = [p?.designation, p?.department].filter((x) => x && x !== name).join(' • ') || (p?.designation ? '' : 'Standard system user');
  return (
    <Dialog id="userProfileModal" open={open} onClose={() => ui({ profileOpen: false })} size="xl" title={name}
      icon={p ? <span className="text-base font-bold">{initialsOf(name)}</span> : <i className="fa-solid fa-user" />}
      badge={p ? <Badge tone={roleTone(p.role || '')}><span id="profileModalRoleBadge">{p.role || 'USER'}</span></Badge> : undefined}
      description={p ? (
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Badge tone={p.active ? 'ok' : 'danger'}><span id="profileModalActiveBadge">{p.active ? 'ACTIVE' : 'INACTIVE'}</span></Badge>
          <span id="profileModalDesignationDept">{sub}</span>
        </span>
      ) : undefined}>
      {q.isPending ? <Skeleton rows={5} /> : q.isError ? <p className="text-sm text-danger text-center py-6">Failed to load user profile: {q.error.message}</p> : p && (
        <div className="grid gap-4 md:grid-cols-2 md:items-start">
          <Section icon="fa-user-shield" title="Account" className="md:col-start-1">
            <Row label="Username" id="profileUsername">{p.username}</Row>
            <Row label="Role" id="profileRole">{p.role}</Row>
            <Row label="Table orders & POS" id="profileOrderPerm">{perm(p.canTakeOrders)}</Row>
            <Row label="Inventory" id="profileInvPerm">{perm(p.canManageInventory)}</Row>
            <Row label="Print bill" id="profilePrintBillPerm">{perm(p.canPrintBill)}</Row>
          </Section>
          <Section icon="fa-briefcase" title="Employment" className="md:col-start-2 md:row-span-2 md:row-start-1">
            <Row label="Full name" id="profileFullName">{p.employeeName || p.username}</Row>
            <Row label="Designation" id="profileDesignation">{p.designation}</Row>
            <Row label="Phone" id="profilePhone">{p.phone}</Row>
            <Row label="Email" id="profileEmail">{p.email}</Row>
            <Row label="Department" id="profileDepartment">{p.department}</Row>
            <Row label="Joined" id="profileJoinDate">{niceDate(p.joinedDate)}</Row>
            <Row label="Basic salary" id="profileSalary">{p.basicSalary != null ? rupees(p.basicSalary) : null}</Row>
            <Row label="Leave quota" id="profileLeavesQuota">{p.paidLeavesQuota != null && p.casualLeavesQuota != null ? `${p.paidLeavesQuota || 0} paid / ${p.casualLeavesQuota || 0} casual days per year` : null}</Row>
            <Row label="Address" id="profileAddress">{p.address}</Row>
          </Section>
          <Section icon="fa-building-columns" title="Bank & payout" className="md:col-start-1">
            <Row label="Account holder" id="profileBankAccountHolder">{p.bankAccountHolderName || p.employeeName}</Row>
            <Row label="Bank" id="profileBankName">{p.bankName}</Row>
            <Row label="Account number" id="profileBankAccountNumber" mono>{p.bankAccountNumber}</Row>
            <Row label="IFSC" id="profileBankIfsc" mono>{p.bankIfsc}</Row>
            <Row label="Branch" id="profileBankBranch">{p.bankBranch}</Row>
            <Row label="UPI ID" id="profileUpiId" mono>{p.upiId}</Row>
          </Section>
        </div>
      )}
    </Dialog>
  );
}
