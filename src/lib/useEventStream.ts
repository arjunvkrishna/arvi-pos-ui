import { useEffect, useRef } from 'react';
import { API_BASE, authHeaders, refreshAccessToken, logout } from '../api/client';
import { getSession } from '../api/session';

interface StreamOptions {
  path: string;
  /** SSE event name that means "something changed". */
  event: string;
  enabled: boolean;
  onSignal: () => void;
  /** Runs on every (re)connect so anything missed while disconnected is refetched. */
  onConnected: () => void;
}

/**
 * One live connection (Server-Sent Events over fetch, so the JWT stays in a header, never in a URL).
 * The server only sends a content-free "changed" signal; REST stays the source of truth.
 * Reconnects with capped backoff and drops half-open connections (the server pings every 25 s).
 * Safe under React StrictMode: effect cleanup aborts the connection, so only one stays open.
 */
export function useEventStream({ path, event, enabled, onSignal, onConnected }: StreamOptions) {
  const handlers = useRef({ onSignal, onConnected });
  useEffect(() => { handlers.current = { onSignal, onConnected }; });

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let controller: AbortController | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let signalTimer: ReturnType<typeof setTimeout> | null = null;
    let failures = 0;

    const scheduleSignal = () => {
      if (signalTimer) return;                                      // coalesce bursts into one refetch
      signalTimer = setTimeout(() => { signalTimer = null; handlers.current.onSignal(); }, 150);
    };

    const connect = async () => {
      const session = getSession();
      if (stopped || !session?.token) return;
      const c = new AbortController();
      controller = c;
      let stalled = false;
      let lastActivity = Date.now();
      const watchdog = setInterval(() => {
        if (Date.now() - lastActivity > 70_000) { stalled = true; c.abort(); }
      }, 15_000);
      let giveUp = false;
      try {
        const res = await fetch(`${API_BASE}${path}`, {
          headers: authHeaders({ Accept: 'text/event-stream' }),
          signal: c.signal,
        });
        if (res.status === 401) {
          if (await refreshAccessToken()) throw new Error('token refreshed, reconnecting');
          giveUp = true; logout(); return;
        }
        if (res.status === 403) { giveUp = true; return; }
        if (!res.ok || !res.body) throw new Error(`stream unavailable: ${res.status}`);

        failures = 0;
        handlers.current.onConnected();
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        const marker = new RegExp(`^event:\\s*${event}`, 'm');
        let buffer = '';
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          lastActivity = Date.now();
          buffer += decoder.decode(value, { stream: true });
          let idx: number;
          while ((idx = buffer.indexOf('\n\n')) >= 0) {
            const chunk = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            if (marker.test(chunk)) scheduleSignal();
          }
        }
      } catch {
        if (c.signal.aborted && !stalled) return;
        failures++;
      } finally {
        clearInterval(watchdog);
        if (controller === c) controller = null;
      }
      if (stopped || giveUp || (c.signal.aborted && !stalled)) return;
      const delay = Math.min(30_000, 1000 * 2 ** Math.min(failures, 5));
      retryTimer = setTimeout(() => { retryTimer = null; void connect(); }, delay);
    };

    void connect();
    return () => {
      stopped = true;
      controller?.abort();
      if (retryTimer) clearTimeout(retryTimer);
      if (signalTimer) clearTimeout(signalTimer);
    };
  }, [path, event, enabled]);
}
