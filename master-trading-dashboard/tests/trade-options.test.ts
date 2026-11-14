import test from 'node:test';
import assert from 'node:assert/strict';
import { pnlPercentLabel, pnlPercentOf } from '../lib/format.ts';
import {
  ACCOUNT_OPTIONS,
  ALGORITHM_OPTIONS,
  ENTRY_TIMEFRAME_OPTIONS,
  INSTRUMENT_OPTIONS,
  MARKET_CONDITION_OPTIONS,
  ORDER_TYPE_OPTIONS,
  OUTCOME_TAG_OPTIONS,
  SESSION_OPTIONS,
  SETUP_OPTIONS,
  TF_ALIGN_OPTIONS,
  TF_TYPE_OPTIONS,
  withStored,
} from '../lib/trade-options.ts';

test('PnL percent is derived from net P&L and account balance', () => {
  assert.equal(pnlPercentOf(-25, 1000), -2.5);
  assert.equal(pnlPercentOf(479.58, 14232), 3.37);
  assert.equal(pnlPercentOf(0, 10000), 0);
  assert.equal(pnlPercentOf(null, 10000), null);
  assert.equal(pnlPercentOf(500, null), null);
  assert.equal(pnlPercentOf(500, 0), null);
  assert.equal(pnlPercentLabel(3.37), '+3.37 %');
  assert.equal(pnlPercentLabel(-2.5), '-2.50 %');
  assert.equal(pnlPercentLabel(null), '—');
});

test('pickable vocabularies are unique, non-empty and cover the recorded journal', () => {
  const lists = {
    accounts: ACCOUNT_OPTIONS,
    instruments: INSTRUMENT_OPTIONS,
    setups: SETUP_OPTIONS,
    sessions: SESSION_OPTIONS,
    conditions: MARKET_CONDITION_OPTIONS,
    algorithms: ALGORITHM_OPTIONS,
    orderTypes: ORDER_TYPE_OPTIONS,
    outcomeTags: OUTCOME_TAG_OPTIONS,
    entryTimeframes: ENTRY_TIMEFRAME_OPTIONS,
    tfAlign: TF_ALIGN_OPTIONS,
    tfTypes: TF_TYPE_OPTIONS,
  };
  for (const [name, list] of Object.entries(lists)) {
    assert.ok(list.length > 0, `${name} is empty`);
    assert.equal(new Set(list).size, list.length, `${name} contains a duplicate`);
    assert.ok(list.every(value => value.trim().length > 0), `${name} contains a blank value`);
  }
  // Values already present in the production journal must remain selectable.
  for (const session of ['London Medium', 'London Opening', 'New York End', 'Tokio Medium', 'Sydney End']) {
    assert.ok(SESSION_OPTIONS.includes(session), `session ${session} is missing`);
  }
  for (const setup of ['LTF Reversal', 'Continuation', 'HTF Continuation', 'Prev Structure']) {
    assert.ok(SETUP_OPTIONS.includes(setup), `setup ${setup} is missing`);
  }
  for (const condition of ['Bearish Ranging', 'Bullish Ranging', 'Ranging']) {
    assert.ok(MARKET_CONDITION_OPTIONS.includes(condition), `condition ${condition} is missing`);
  }
  assert.ok(TF_TYPE_OPTIONS.includes('1m Type 3'));
  assert.ok(TF_TYPE_OPTIONS.includes('4hr Type 3'));
});

test('stored values outside the vocabulary stay editable', () => {
  assert.deepEqual(withStored(['A', 'B'], ['B']), ['A', 'B']);
  assert.deepEqual(withStored(['A', 'B'], ['Legacy']), ['A', 'B', 'Legacy']);
});
