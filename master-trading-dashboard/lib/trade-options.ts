/**
 * The pickable vocabulary of the journal.
 *
 * Every categorical trade field is filled by choosing from these lists, never
 * by typing. The values come from the journal itself (the sessions, setups and
 * timeframes already recorded in the database), with the obvious extensions
 * kept in the same spelling so filters and analytics do not split a category
 * into two labels.
 *
 * Numbers and prose stay free: Net P&L, balance, R, lots, MFE/MAE are typed,
 * and the review notes are written. Everything else is a choice.
 */

export const ACCOUNT_OPTIONS: string[] = [
  'Forwardtesting',
  'Backtest',
];

export const INSTRUMENT_OPTIONS: string[] = [
  'XAU/USD',
  'XAU/EUR',
  'EUR/USD',
  'GBP/USD',
  'USD/JPY',
  'GBP/JPY',
  'AUD/USD',
  'USD/CHF',
  'USD/CAD',
  'NAS100',
  'NQ',
  'US30',
  'SPX500',
  'GER40',
  'BTC/USD',
  'ETH/USD',
  'Intel',
];

export const DIRECTION_OPTIONS: string[] = ['Long', 'Short'];

export const SETUP_OPTIONS: string[] = [
  'Continuation Block',
  'Continuation',
  'LTF Continuation',
  'HTF Continuation',
  'Reversal',
  'LTF Reversal',
  'HTF Reversal',
  'Liquidity Sweep',
  'Prev Structure',
  'Range Rejection',
  'Breakout',
];

/** Chronological through the trading day, using the journal's own labels. */
export const SESSION_OPTIONS: string[] = [
  'Sydney Opening',
  'Sydney Medium',
  'Sydney End',
  'Tokio Opening',
  'Tokio Medium',
  'Tokio End',
  'London Opening',
  'London Medium',
  'London Ending',
  'New York Opening',
  'New York Medium',
  'New York End',
];

export const MARKET_CONDITION_OPTIONS: string[] = [
  'Bullish',
  'Bearish',
  'Ranging',
  'Bullish Ranging',
  'Bearish Ranging',
];

export const ALGORITHM_OPTIONS: string[] = ['CBR', 'CBC', 'Stocks'];

export const ORDER_TYPE_OPTIONS: string[] = ['Market', 'Limit', 'Stop'];

export const OUTCOME_TAG_OPTIONS: string[] = ['Win', 'Small win', 'Loss', 'Small loss', 'B/E'];

export const ENTRY_TIMEFRAME_OPTIONS: string[] = ['5s', '1m', '5m', '15m', '30m', '1h', '4h'];

export const TF_ALIGN_OPTIONS: string[] = ['5s', '1m', '5m', '15m', '30m', '1h', '4h'];

/**
 * "1m Type 3" is the journal's existing spelling for an entry timeframe with
 * its setup type. Generating the ladder keeps every combination selectable
 * without inventing a second vocabulary.
 */
export const TF_TYPE_OPTIONS: string[] = ['5s', '1m', '5m', '15m', '30m', '1hr', '4hr']
  .flatMap(timeframe => ['Type 1', 'Type 2', 'Type 3'].map(type => `${timeframe} ${type}`));

/** Merge a stored value into a fixed option list so old rows stay editable. */
export function withStored(options: string[], values: string[]): string[] {
  return [...options, ...values.filter(value => !options.includes(value))];
}

/** Include a stored single value in a select so an import is never hidden. */
export function withCurrentValue(options: string[], current: string | null | undefined): string[] {
  return current && !options.includes(current) ? [...options, current] : options;
}
