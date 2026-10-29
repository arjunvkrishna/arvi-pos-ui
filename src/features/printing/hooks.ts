import { useQuery } from '@tanstack/react-query';
import { useSession } from '../../api/session';
import { canTakeOrders } from '../../auth/tabs';
import { fetchBridgeStatus, fetchLanStatus, fetchPrinterConfig, printerKey, type LanStatus, type PrinterType } from './api';
import { summariseHealth } from './rules';

/** Receipt wording, printer addresses and layout. Managers and order-takers read it (the receipts need it); only managers change it. */
export function usePrinterConfig() {
  const user = useSession((s) => s.user);
  return useQuery({ queryKey: [...printerKey, 'config'], enabled: !!user && canTakeOrders(user), queryFn: () => fetchPrinterConfig().catch(() => null), staleTime: 60_000 });
}

/** Bridge + the three printers: live when `live`, otherwise a recent result is fine (the header dot). */
export function usePrinterHealth(opts: { live?: boolean; enabled?: boolean } = {}) {
  const role = useSession((s) => s.user?.role);
  const eligible = (role === 'ADMIN' || role === 'MANAGER') && opts.enabled !== false;
  return useQuery({
    queryKey: [...printerKey, 'health', opts.live ? 'live' : 'cached'],
    enabled: eligible,
    refetchInterval: opts.live ? false : 300_000,
    staleTime: 0,
    queryFn: async () => {
      const bridge = await fetchBridgeStatus();
      const types: PrinterType[] = ['BILL', 'KOT', 'JUICE_KOT'];
      const res = await Promise.all(types.map((t) => fetchLanStatus(t, !opts.live)));
      const lan = Object.fromEntries(types.map((t, i) => [t, res[i]])) as Record<PrinterType, LanStatus | null>;
      return { bridge, lan, health: summariseHealth(bridge, lan) };
    },
  });
}
