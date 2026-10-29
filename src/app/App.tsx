import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router';
import { useSession } from '../api/session';
import { Toaster } from '../components/Toaster';
import { HashBridge } from './HashBridge';
import { CrashBoundary } from './errors/ErrorPages';
import { AppRoutes } from './routes';

const queryClient = new QueryClient({
  // networkMode 'always': requests are really tried while the browser says it is offline, so a failed save can wait in the outbox and the menu can fall back to its offline copy (the default would pause them silently)
  defaultOptions: { queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: true, networkMode: 'always' }, mutations: { networkMode: 'always' } },
});

/** A different person (or nobody) must never see the previous person's cached data. */
function ClearCacheOnUserChange() {
  const username = useSession((s) => s.user?.username ?? null);
  useEffect(() => { queryClient.clear(); }, [username]);
  return null;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <ClearCacheOnUserChange />
        <HashBridge />
        <CrashBoundary><AppRoutes /></CrashBoundary>
        <Toaster />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
