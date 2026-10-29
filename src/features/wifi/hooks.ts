import { useQuery } from '@tanstack/react-query';
import { nativePrinter } from '../../native/printer';
import { fetchDirectPrintSsids } from '../printing/api';

export const cafeWifiKey = ['cafe-wifi'] as const;
const PHONE_CHECK_MS = 5_000;

/** The phone's own Wi-Fi state, read on the phone every few seconds (no server traffic) so the name follows the network the staff move to. */
export function usePhoneWifi() {
  const native = nativePrinter();
  return useQuery({
    queryKey: ['phone-wifi'],
    queryFn: () => native!.getStatus(),
    enabled: native !== null,
    refetchInterval: PHONE_CHECK_MS, staleTime: 0, retry: false, networkMode: 'always',
  });
}

/** The cafe Wi-Fi name(s) the admin set on the server. */
export function useCafeWifi(enabled: boolean) {
  return useQuery({ queryKey: cafeWifiKey, queryFn: fetchDirectPrintSsids, enabled, staleTime: 30_000, retry: false });
}
