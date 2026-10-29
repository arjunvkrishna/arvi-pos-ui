/** Loyalty points rules shared by the Customers screen and the payment dialog. The server enforces the same rules. */

/** ₹100 of paid spend earns 1 point; 1 point pays ₹1. */
export const RUPEES_PER_POINT_EARNED = 100;
export const RUPEES_PER_POINT_REDEEMED = 1;
export const DEFAULT_MIN_REDEEM = 100;
/** An expiry within this many days is shown as a warning. */
export const EXPIRING_SOON_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The cafe's trading day (Asia/Kolkata, changing at 04:00) as YYYY-MM-DD, the same day the server counts. */
export function businessToday(now: Date = new Date()): string {
  const shifted = new Date(now.getTime() + (5.5 - 4) * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

const parts = (ymd: string) => ymd.split('-').map(Number) as [number, number, number];
const daysBetween = (from: string, to: string) => {
  const [fy, fm, fd] = parts(from);
  const [ty, tm, td] = parts(to);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / DAY_MS);
};

export const pointsEarnedFor = (spendRupees: number) =>
  spendRupees > 0 ? Math.floor(spendRupees / RUPEES_PER_POINT_EARNED) : 0;

export type ExpiryTone = 'none' | 'ok' | 'soon' | 'lapsed';
export interface ExpiryInfo {
  tone: ExpiryTone;
  label: string;
  /** Days until the last valid day (0 = today); negative once lapsed; null without a date. */
  daysLeft: number | null;
}

const niceDate = (ymd: string) => {
  const [y, m, d] = parts(ymd);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

/** What to say about a customer's points deadline. `expireAt` is the last day the points are valid. */
export function expiryInfo(balance: number, expireAt: string | null | undefined, today: string): ExpiryInfo {
  if (!(balance > 0) || !expireAt) return { tone: 'none', label: '', daysLeft: null };
  const daysLeft = daysBetween(today, expireAt);
  if (daysLeft < 0) return { tone: 'lapsed', label: `Expired ${niceDate(expireAt)}`, daysLeft };
  if (daysLeft === 0) return { tone: 'soon', label: 'Expires today', daysLeft };
  if (daysLeft === 1) return { tone: 'soon', label: 'Expires tomorrow', daysLeft };
  if (daysLeft <= EXPIRING_SOON_DAYS) return { tone: 'soon', label: `Expires in ${daysLeft} days`, daysLeft };
  return { tone: 'ok', label: `Valid till ${niceDate(expireAt)}`, daysLeft };
}

export interface RedeemLimits {
  canRedeem: boolean;
  /** Least points per redemption (and the least balance that can redeem). */
  min: number;
  /** Most points for this bill: the balance, or the bill if that is less. */
  max: number;
  reason: string | null;
}

/** How many points a customer may use on a bill of `billRupees`, given the minimum. */
export function redeemLimits(balance: number, billRupees: number, min: number, lapsed = false): RedeemLimits {
  const max = Math.max(0, Math.min(Math.floor(balance), Math.floor(billRupees / RUPEES_PER_POINT_REDEEMED)));
  if (lapsed) return { canRedeem: false, min, max: 0, reason: 'These points have expired.' };
  if (balance < min) return { canRedeem: false, min, max, reason: `Needs at least ${min} points to redeem (has ${Math.floor(balance)}).` };
  if (max < min) return { canRedeem: false, min, max, reason: `This bill (₹${Math.floor(billRupees)}) is less than the ${min}-point minimum.` };
  return { canRedeem: true, min, max, reason: null };
}

/** Why a typed redemption cannot go through, or null when it can. */
export function redeemProblem(points: number, limits: RedeemLimits): string | null {
  if (!limits.canRedeem) return limits.reason;
  if (!Number.isFinite(points) || points <= 0) return 'Enter the points to redeem.';
  if (points < limits.min) return `The least that can be redeemed is ${limits.min} points.`;
  if (points > limits.max) return `At most ${limits.max} points can be used on this bill.`;
  return null;
}
