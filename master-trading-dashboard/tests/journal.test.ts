import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarCells, drawdownPoints, filterJournal, groupTradingDays, journalSummary, shiftMonth, tradesToCsv } from '../lib/journal.ts';
import type { Trade } from '../lib/types.ts';

const trade = (id: string, changes: Partial<Trade> = {}): Trade => ({ id, tradeId: id, tradeNumber: 1, account: ['Forwardtesting'], dateTime: '2026-10-08T22:30:00Z', day: null, pair: 'XAU/USD', position: 'Long', netEur: 100, accountBalance: null, rMultiple: 1, setup: ['Reversal'], tfType: [], algorithm: [], sessionTime: ['London'], liquiditySweep: false, dxy: false, delta: false, fractalShift: false, lastEditedTime: null, ...changes });
const defaults = { search: '', outcome: 'all' as const, pair: 'all', order: 'latest' as const };

test('calendar groups trades by configured timezone and keeps unrecorded outcomes distinct', () => {
  const trades = [trade('1'), trade('2', { netEur: -25 }), trade('3', { netEur: null }), trade('4', { dateTime: null }), trade('5', { dateTime: 'invalid' })];
  const days = groupTradingDays(trades, 'Europe/Berlin');
  assert.equal(days.length, 1); assert.equal(days[0].date, '2026-10-09');
  assert.equal(days[0].pnl, 75); assert.equal(days[0].closed, 2); assert.equal(days[0].wins, 1); assert.equal(days[0].count, 3);
  assert.equal(groupTradingDays(trades, 'America/New_York')[0].date, '2026-10-08');
});

test('calendar follows Monday-start weeks, leap years and year boundaries', () => {
  const cells = calendarCells('2024-02');
  assert.deepEqual(cells.slice(0, 4), [null, null, null, '2024-02-01']);
  assert.equal(cells.filter(Boolean).length, 29); assert.equal(cells.length % 7, 0);
  assert.equal(calendarCells('2026-02').filter(Boolean).length, 28);
  assert.deepEqual(calendarCells('2026-13'), []);
  assert.deepEqual(calendarCells('invalid'), []);
  assert.equal(shiftMonth('2026-12', 1), '2027-01'); assert.equal(shiftMonth('2026-01', -1), '2025-12');
});

test('journal combines text, pair and outcome filters without mutating trades', () => {
  const trades = [trade('1'), trade('2', { netEur: -25, pair: 'EUR/USD' }), trade('3', { netEur: null }), trade('4', { netEur: 0 })];
  assert.deepEqual(filterJournal(trades, { ...defaults, search: ' reversal ', outcome: 'win', pair: 'XAU/USD' }).map(row => row.id), ['1']);
  assert.deepEqual(filterJournal(trades, { ...defaults, outcome: 'unrecorded' }).map(row => row.id), ['3']);
  assert.deepEqual(filterJournal(trades, { ...defaults, outcome: 'breakeven' }).map(row => row.id), ['4']);
  assert.deepEqual(filterJournal(trades, { ...defaults, setup: 'Reversal' }).map(row => row.id), ['1', '2', '3', '4']);
  assert.deepEqual(filterJournal(trades, { ...defaults, session: 'London', direction: 'Long' }).map(row => row.id), ['1', '2', '3', '4']);
  assert.deepEqual(filterJournal(trades, { ...defaults, tfType: '1m Type 3' }).map(row => row.id), []);
  assert.deepEqual(filterJournal([trade('5', { tfType: ['1m Type 3'] })], { ...defaults, tfType: '1m Type 3' }).map(row => row.id), ['5']);
  assert.deepEqual(filterJournal(trades, { ...defaults, direction: 'Short' }).map(row => row.id), []);
  assert.deepEqual(trades.map(row => row.id), ['1', '2', '3', '4']);
});

test('sorting keeps missing outcomes and dates last in either direction', () => {
  const trades = [trade('1', { netEur: null, dateTime: null }), trade('2', { netEur: -20, dateTime: '2026-10-07T12:00:00Z' }), trade('3', { netEur: 50 })];
  assert.deepEqual(filterJournal(trades, { ...defaults, order: 'profit' }).map(row => row.id), ['3', '2', '1']);
  assert.deepEqual(filterJournal(trades, { ...defaults, order: 'loss' }).map(row => row.id), ['2', '3', '1']);
  assert.deepEqual(filterJournal(trades, { ...defaults, order: 'oldest' }).map(row => row.id), ['2', '3', '1']);
});

test('CSV quotes multiline data and neutralizes spreadsheet formulas without corrupting numbers', () => {
  const csv = tradesToCsv([trade('1', { tradeId: '=HYPERLINK("bad")', setup: ['one,"two"\nthree'], pair: '\t+formula', netEur: -20 })]);
  assert.ok(csv.startsWith('\uFEFF')); assert.ok(csv.includes('"\'=HYPERLINK(""bad"")"'));
  assert.ok(csv.includes('"\'\t+formula"')); assert.ok(csv.includes('"one,""two""\nthree"'));
  // Net EUR, PnL %, account balance (both empty), R multiple
  assert.ok(csv.includes(',-20,"","",1,'), 'net P&L and R multiple keep their positions');
  assert.ok(csv.includes('Learning')); assert.ok(csv.includes('Setup Quality'));
  assert.equal(tradesToCsv([]).split('\r\n').length, 1);
});

test('summary treats average loss as magnitude and excludes unrecorded days from day win rate', () => {
  const trades = [trade('1'), trade('2', { netEur: -50 }), trade('3', { dateTime: '2026-10-01T12:00:00Z', netEur: null })];
  const summary = journalSummary(trades, groupTradingDays(trades, 'UTC'));
  assert.equal(summary.averageWin, 100); assert.equal(summary.averageLoss, 50); assert.equal(summary.payoff, 2);
  assert.equal(summary.activeDays, 1); assert.equal(summary.profitableDays, 1);
  assert.equal(journalSummary([], []).payoff, null);
});

test('drawdown starts from zero and resets on new realized equity highs', () => {
  assert.deepEqual(drawdownPoints([{ time: '1', value: -20 }, { time: '2', value: 100 }, { time: '3', value: 60 }, { time: '4', value: 120 }]).map(point => point.value), [-20, 0, -40, 0]);
});

test('newest first follows the trade number so a fresh trade is on top', () => {
  const trades = [
    trade('a', { tradeNumber: 5, dateTime: '2026-01-01T10:00:00Z' }),
    trade('b', { tradeNumber: 131, dateTime: null }),
    trade('c', { tradeNumber: 7, dateTime: '2026-03-01T10:00:00Z' }),
  ];
  assert.deepEqual(filterJournal(trades, { ...defaults, order: 'latest' }).map(row => row.id), ['b', 'c', 'a']);
  assert.deepEqual(filterJournal(trades, { ...defaults, order: 'oldest' }).map(row => row.id), ['a', 'c', 'b']);
});
