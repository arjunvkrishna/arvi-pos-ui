import { describe, expect, it } from 'vitest';
import { activeFilterCount, addDays, daysIn, mondayOf, periodLabel, rangeFor, rangeProblem, searchSentence } from './itemsSold';

// 2027-03-10 is a Wednesday
const TODAY = '2027-03-10';

describe('weeks and dates', () => {
  it('finds the Monday of a week, also for a Sunday', () => {
    expect(mondayOf('2027-03-10')).toBe('2027-03-08');
    expect(mondayOf('2027-03-08')).toBe('2027-03-08');
    expect(mondayOf('2027-03-14')).toBe('2027-03-08');   // Sunday belongs to the week before the next Monday
    expect(mondayOf('2027-03-15')).toBe('2027-03-15');
  });
  it('adds days across months and years', () => {
    expect(addDays('2027-03-01', -1)).toBe('2027-02-28');
    expect(addDays('2027-12-31', 1)).toBe('2028-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });
  it('counts both ends', () => {
    expect(daysIn('2027-03-01', '2027-03-01')).toBe(1);
    expect(daysIn('2027-03-01', '2027-03-07')).toBe(7);
  });
});

describe('ranges', () => {
  it('means what it says', () => {
    expect(rangeFor('today', TODAY)).toEqual({ from: TODAY, to: TODAY });
    expect(rangeFor('yesterday', TODAY)).toEqual({ from: '2027-03-09', to: '2027-03-09' });
    expect(rangeFor('last7', TODAY)).toEqual({ from: '2027-03-04', to: TODAY });
    expect(rangeFor('thisWeek', TODAY)).toEqual({ from: '2027-03-08', to: TODAY });
    expect(rangeFor('lastWeek', TODAY)).toEqual({ from: '2027-03-01', to: '2027-03-07' });
    expect(rangeFor('thisMonth', TODAY)).toEqual({ from: '2027-03-01', to: TODAY });
    expect(rangeFor('last30', TODAY)).toEqual({ from: '2027-02-09', to: TODAY });
  });
  it('last week still works on a Monday and across a year end', () => {
    expect(rangeFor('lastWeek', '2027-03-08')).toEqual({ from: '2027-03-01', to: '2027-03-07' });
    expect(rangeFor('lastWeek', '2027-01-04')).toEqual({ from: '2026-12-28', to: '2027-01-03' });
  });
  it('refuses a range the server would refuse', () => {
    expect(rangeProblem('2027-03-10', '2027-03-01')).toMatch(/after/);
    expect(rangeProblem('2026-01-01', '2027-03-01')).toMatch(/366/);
    expect(rangeProblem('', '2027-03-01')).toMatch(/both/);
    expect(rangeProblem('2027-03-01', '2027-03-10')).toBeNull();
  });
});

describe('labels', () => {
  it('writes a day and a week', () => {
    expect(periodLabel('2027-03-10', '2027-03-10', 'DAY')).toMatch(/^Wed, 10 Mar$/);
    expect(periodLabel('2027-03-08', '2027-03-14', 'WEEK')).toBe('8 Mar - 14 Mar');
    expect(periodLabel('2027-03-10', '2027-03-10', 'WEEK')).toBe('10 Mar');
  });
});

describe('search sentence', () => {
  it('says how many were sold', () => {
    expect(searchSentence('biriyani', 143, 4, '₹28,600.00')).toBe('"biriyani": 143 sold across 4 dishes · ₹28,600.00');
    expect(searchSentence(' biryani ', 1, 1, '₹200.00')).toBe('"biryani": 1 sold across 1 dish · ₹200.00');
  });
  it('says so when nothing matched, and stays quiet with no search', () => {
    expect(searchSentence('pizza', 0, 0, '₹0.00')).toBe('Nothing matching "pizza" was sold in this range.');
    expect(searchSentence('  ', 10, 2, '₹1')).toBeNull();
  });
});

describe('reset link', () => {
  it('counts what differs from the default view', () => {
    expect(activeFilterCount({ q: '', categories: 0, orderTypes: 0, range: 'last7', groupBy: 'DAY' })).toBe(0);
    expect(activeFilterCount({ q: 'tea', categories: 2, orderTypes: 1, range: 'thisMonth', groupBy: 'WEEK' })).toBe(5);
  });
});
