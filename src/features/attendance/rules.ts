import type { PunchStatus, Summary } from './api';

export const attendanceTone = (status: string) => (status === 'PRESENT' ? 'ok' : status === 'ABSENT' ? 'danger' : status === 'HALF_DAY' ? 'warn' : 'info') as 'ok' | 'danger' | 'warn' | 'info';
export const percentTone = (pct: number) => (pct >= 80 ? 'ok' : pct >= 50 ? 'warn' : 'danger') as 'ok' | 'warn' | 'danger';

export function joinedNote(s: Pick<Summary, 'joinedDate' | 'year' | 'month'>): string {
  if (!s.joinedDate) return 'Joined prior (full month)';
  const [y, m, d] = s.joinedDate.split('-').map((p) => parseInt(p, 10));
  if (y === s.year && m === s.month) return `Joined day ${d} of this month`;
  if (y > s.year || (y === s.year && m > s.month)) return 'Joined in future month';
  return 'Joined prior to this month';
}

/** Years offered in the summary: two back, one ahead. */
export const summaryYears = (now = new Date()) => { const y = now.getFullYear(); return [y - 2, y - 1, y, y + 1]; };

/** Check In is usable only while no shift is open, Check Out only while one is. Both wait for the server's answer. */
export const punchButtons = (state: PunchStatus | undefined, working: boolean) => ({
  checkInDisabled: working || !state || state.checkedIn,
  checkOutDisabled: working || !state || !state.checkedIn,
});

export const punchText = (state: PunchStatus | undefined, today: string, idle: string) => {
  if (!state?.checkedIn) return idle;
  const away = state.shiftDate && state.shiftDate !== today ? ` (${state.shiftDate})` : '';
  return `Checked in since ${String(state.since ?? '').slice(0, 5)}${away}. Check out when your shift ends.`;
};
