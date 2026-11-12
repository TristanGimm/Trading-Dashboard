/**
 * Colour vocabulary for journal tags.
 *
 * The tones mirror the setup-quality ladder: grey, yellow, green, blue, purple,
 * prismatic. Every tag in the journal is read the same way, so the colour is a
 * consequence of the value rather than something each screen decides.
 */

export type TagTone = 'grey' | 'yellow' | 'green' | 'blue' | 'purple' | 'red' | 'prismatic';

/** CBR reads as blue, CBC as green; anything else stays neutral. */
export function algorithmTone(value: string | null | undefined): TagTone {
  const text = value?.trim().toLowerCase() ?? '';
  if (text === 'cbr') return 'blue';
  if (text === 'cbc') return 'green';
  return 'grey';
}

/**
 * Setup names, most specific first: "Continuation Block" and the bare
 * "Reversal" label are their own tags and must not fall through to the
 * timeframe-qualified continuation/reversal colours.
 */
export function setupTone(value: string | null | undefined): TagTone {
  const text = value?.trim().toLowerCase() ?? '';
  if (!text) return 'grey';
  if (text === 'continuation block') return 'blue';
  if (text === 'reversal') return 'blue';
  if (text.includes('continuation')) return 'green';
  if (text.includes('reversal')) return 'red';
  // Prev Structure, Range Rejection, Liquidity Sweep, Breakout: neutral.
  return 'grey';
}

export function conditionTone(value: string | null | undefined): TagTone {
  const text = value?.toLowerCase() ?? '';
  const bearish = text.includes('bear');
  const bullish = text.includes('bull');
  if (bearish && !bullish) return 'red';
  if (bullish && !bearish) return 'green';
  return 'grey';
}

/** London green, New York red, Sydney purple, Asia/Tokyo yellow. */
export function sessionTone(value: string | null | undefined): TagTone {
  const text = value?.trim().toLowerCase() ?? '';
  if (!text) return 'grey';
  if (text.includes('london')) return 'green';
  if (text.includes('new york') || text === 'ny') return 'red';
  if (text.includes('sydney')) return 'purple';
  if (text.includes('asia') || text.includes('tokio') || text.includes('tokyo')) return 'yellow';
  return 'grey';
}

const UNIT_MINUTES: Record<string, number> = {
  s: 1 / 60, sec: 1 / 60, secs: 1 / 60, second: 1 / 60, seconds: 1 / 60,
  m: 1, min: 1, mins: 1, minute: 1, minutes: 1,
  h: 60, hr: 60, hrs: 60, hour: 60, hours: 60,
  d: 1440, day: 1440, days: 1440,
  w: 10080, week: 10080, weeks: 10080,
};

/** Read the leading timeframe out of values such as "1hr Type 3" or "5s". */
export function timeframeMinutes(value: string | null | undefined): number | null {
  const match = /(\d+(?:\.\d+)?)\s*(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w)\b/i.exec(value?.trim() ?? '');
  if (!match) return null;
  const unit = UNIT_MINUTES[match[2].toLowerCase()];
  if (!unit) return null;
  const minutes = Number(match[1]) * unit;
  return Number.isFinite(minutes) ? minutes : null;
}

/**
 * Rising timeframe, rising tier: seconds stay common, a minute is magic, five
 * minutes rare, fifteen epic, an hour legendary and four hours ascension.
 */
export function timeframeTone(value: string | null | undefined): TagTone {
  const minutes = timeframeMinutes(value);
  if (minutes === null) return 'grey';
  if (minutes < 1) return 'grey';
  if (minutes < 5) return 'yellow';
  if (minutes < 15) return 'green';
  if (minutes < 60) return 'blue';
  if (minutes < 240) return 'purple';
  return 'prismatic';
}

/** Human hint for the tooltip, so the ladder is learnable rather than magic. */
export function timeframeHint(value: string): string {
  const minutes = timeframeMinutes(value);
  if (minutes === null) return value;
  if (minutes < 1) return `${value} · seconds tier`;
  if (minutes < 5) return `${value} · 1 minute tier`;
  if (minutes < 15) return `${value} · 5 minute tier`;
  if (minutes < 60) return `${value} · 15 minute tier`;
  if (minutes < 240) return `${value} · hourly tier`;
  return `${value} · higher timeframe tier`;
}
