import { useQuery } from '@tanstack/react-query';
import { useSession } from '../../api/session';
import { canPrintBill } from '../../auth/tabs';
import { imageUrl } from '../settings/api';

/**
 * The payment QR in effect for the signed-in person's branch (the branch's own, else the cafe's), as a picture URL; null when the cafe
 * has not uploaded one. Only fetched for people who print bills. Kept for a few minutes so a bill never waits for it when it is printed.
 */
export function usePaymentQr() {
  const user = useSession((s) => s.user);
  const branch = user?.selectedOutletId ?? user?.outletId ?? null;
  return useQuery({ queryKey: ['payment-qr', user?.tenantCode ?? '', branch], queryFn: () => imageUrl('payment-qr', branch), enabled: !!user && !user.platform && canPrintBill(user), staleTime: 5 * 60_000, retry: false });
}
