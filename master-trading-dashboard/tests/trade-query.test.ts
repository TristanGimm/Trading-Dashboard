import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTradeWhere } from '../lib/trade-query.ts';
import { getDashboardTimezone } from '../lib/timezone.ts';

test('trade query binds account input and limits period on both sides', () => {
  const now = new Date('2026-10-08T12:00:00Z');
  const input = "x'); DROP TABLE trades; --";
  const query = buildTradeWhere({ account: input, period: '30d' }, now);
  assert.equal(query.sql, ' WHERE account @> ARRAY[$1]::text[] AND date_time >= $2 AND date_time <= $3');
  assert.deepEqual(query.values, [input, new Date('2026-09-08T12:00:00Z'), now]);
  assert.deepEqual(buildTradeWhere({ account: 'all', period: 'all' }), { sql: '', values: [] });
  assert.deepEqual(buildTradeWhere({ period: 'toString' }), { sql: '', values: [] });
});

test('invalid timezone falls back to Berlin; valid configured timezone is preserved', () => {
  assert.equal(getDashboardTimezone('Invalid/Timezone'), 'Europe/Berlin');
  assert.equal(getDashboardTimezone(), 'Europe/Berlin');
  assert.equal(getDashboardTimezone('America/New_York'), 'America/New_York');
});
