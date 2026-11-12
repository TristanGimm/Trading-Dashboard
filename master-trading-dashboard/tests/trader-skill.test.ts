import test from 'node:test';
import assert from 'node:assert/strict';
import { traderSkill, streakStats, tradingStreaks } from '../lib/trader-skill.ts';
import { calculatePerformance } from '../lib/analytics.ts';
import { groupTradingDays } from '../lib/journal.ts';
import type { Trade } from '../lib/types.ts';
const trade = (id: number, netEur: number | null): Trade => ({ id: String(id), tradeId: String(id), tradeNumber: id, account: ['Forwardtesting'], dateTime: `2026-10-${String(id).padStart(2, '0')}T08:00:00Z`, day: null, pair: 'EUR/USD', position: 'Long', netEur, accountBalance: null, rMultiple: null, setup: [], tfType: [], algorithm: [], sessionTime: [], liquiditySweep: false, dxy: false, delta: false, fractalShift: false, lastEditedTime: null });
const score = (trades: Trade[]) => traderSkill(calculatePerformance(trades), groupTradingDays(trades, 'Europe/Berlin'));
test('empty and unrecorded histories have no score; all losses score zero', () => {
 assert.equal(score([]).score, null);
 assert.equal(score([trade(1, null)]).score, null);
 assert.equal(score([trade(1, -100), trade(2, -50)]).score, 0);
});
test('score is finite, capped, and provisional for small samples', () => {
 const skill = score([trade(1, 100), trade(2, 50)]);
 assert.equal(skill.score, 100);
 assert.equal(skill.provisional, true);
 assert.ok(skill.dimensions.every(axis => Number.isFinite(axis.value) && axis.value >= 0 && axis.value <= 100));
 assert.equal(score([trade(1, 0)]).score, 0);
});
test('score is invariant under a change in position size', () => {
 const trades = [trade(1, 100), trade(2, -40), trade(3, 60), trade(4, -70)];
 assert.equal(score(trades).score, score(trades.map(trade => ({ ...trade, netEur: trade.netEur! * 10 }))).score);
});
test('streaks reset at break even and count winning and losing records', () => {
 assert.deepEqual(streakStats([10, 5, -2, -3, 0, 1]), { current: 1, bestWin: 2, bestLoss: 2 });
 assert.deepEqual(streakStats([10, 0]), { current: 0, bestWin: 1, bestLoss: 0 });
});
test('trade streaks are chronological and exclude undated or unrecorded trades', () => {
 const trades = [trade(3, -20), trade(1, 10), trade(2, 5), trade(4, null), { ...trade(5, 100), dateTime: null }];
 assert.deepEqual(tradingStreaks(trades, []).trades, { current: -1, bestWin: 2, bestLoss: 1 });
});
