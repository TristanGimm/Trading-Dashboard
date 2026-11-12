import type { Trade } from './types';

// Entirely synthetic, deterministic journal. Never merged with the real database.
export function makeDemoTrades(now = new Date()): Trade[] {
  const trades: Trade[] = [];
  const outcomes = [182, -74, 263, 96, -118, 0, 341, -82, 157, 224, -95, 138, 72, -64, 289];
  let balance = 10000;
  for (let day = 78; day >= 0; day--) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day, 8, 30));
    if (date.getUTCDay() === 0 || date.getUTCDay() === 6) continue;
    const count = day % 3 === 0 ? 3 : 2;
    for (let entry = 0; entry < count; entry++) {
      const index = trades.length;
      const base = outcomes[(index * 7 + day) % outcomes.length];
      const netEur = day <= 2 && entry === count - 1 ? null : day % 9 < 2 ? -Math.abs(base) : base;
      balance += netEur ?? 0;
      const timestamp = new Date(date.getTime() + entry * 3 * 3600000);
      trades.push({
        id: `demo-${index}`, tradeId: String(1000 + index), tradeNumber: 1000 + index,
        account: ['Forwardtesting'], dateTime: timestamp.toISOString(), day: null,
        pair: ['XAU/USD', 'EUR/USD', 'GBP/USD', 'NQ'][index % 4], position: index % 3 ? 'Long' : 'Short',
        recordedOutcome: netEur === null ? 'win' : null, mfe30m: index % 4 ? (index % 13) / 2 : null, mae30m: index % 3 ? (index % 7) / 4 : null,
        netEur, accountBalance: balance, rMultiple: netEur === null ? null : Math.round(netEur / 100 * 100) / 100,
        setup: [index % 2 ? 'LTF Reversal' : 'Continuation'], tfType: index % 3 ? ['1m Type 3', ...(index % 5 === 0 ? ['5s Type 3'] : [])] : [],
        algorithm: ['CBR'], sessionTime: [entry ? 'New York' : 'London'],
        liquiditySweep: index % 3 !== 0, dxy: index % 2 === 0, delta: index % 4 === 0, fractalShift: index % 5 === 0,
        lastEditedTime: timestamp.toISOString(),
      });
    }
  }
  return trades;
}
