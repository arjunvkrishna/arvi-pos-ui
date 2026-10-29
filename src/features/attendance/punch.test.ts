import { describe, expect, it } from 'vitest';
import { punchButtons, punchText } from './rules';

const IDLE = 'Punch your daily shift time or submit a leave application.';

describe('Check In / Check Out: one at a time', () => {
  it('not checked in: only Check In is usable', () => {
    expect(punchButtons({ checkedIn: false }, false)).toEqual({ checkInDisabled: false, checkOutDisabled: true });
  });
  it('checked in: only Check Out is usable', () => {
    expect(punchButtons({ checkedIn: true, since: '09:00:00' }, false)).toEqual({ checkInDisabled: true, checkOutDisabled: false });
  });
  it('both wait while the server is working or has not answered yet', () => {
    expect(punchButtons({ checkedIn: false }, true)).toEqual({ checkInDisabled: true, checkOutDisabled: true });
    expect(punchButtons(undefined, false)).toEqual({ checkInDisabled: true, checkOutDisabled: true });
  });
  it('the status line says since when, and which day for a shift past midnight', () => {
    expect(punchText({ checkedIn: false }, '2026-10-23', IDLE)).toBe(IDLE);
    expect(punchText({ checkedIn: true, since: '09:05:33', shiftDate: '2026-10-23' }, '2026-10-23', IDLE)).toBe('Checked in since 09:05. Check out when your shift ends.');
    expect(punchText({ checkedIn: true, since: '22:00:00', shiftDate: '2026-10-22' }, '2026-10-23', IDLE)).toContain('(2026-10-22)');
  });
});
