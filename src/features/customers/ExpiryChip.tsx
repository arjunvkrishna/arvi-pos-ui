import { Badge } from '../../components/ui';
import type { Customer } from './api';
import { businessToday, expiryInfo } from './loyalty';

/** When a customer's points run out: green with plenty of time, amber in the last two weeks, red once they have lapsed. */
export function ExpiryChip({ customer }: { customer: Pick<Customer, 'pointsBalance' | 'pointsExpireAt'> }) {
  const info = expiryInfo(customer.pointsBalance, customer.pointsExpireAt, businessToday());
  if (info.tone === 'none') return null;
  const tone = info.tone === 'lapsed' ? 'danger' : info.tone === 'soon' ? 'warn' : 'neutral';
  return <span data-testid="points-expiry" data-tone={info.tone}><Badge tone={tone}>{info.label}</Badge></span>;
}
