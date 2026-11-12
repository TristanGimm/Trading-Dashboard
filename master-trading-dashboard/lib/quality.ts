export const QUALITY_TIERS = ['Common', 'Magic', 'Rare', 'Epic', 'Legendary', 'Ascension'] as const;

export type QualityTier = (typeof QUALITY_TIERS)[number];

export type QualityMeta = {
  tier: QualityTier;
  hint: string;
  /** Short label used in dense table cells. */
  short: string;
};

export const QUALITY_META: Record<QualityTier, QualityMeta> = {
  Common: { tier: 'Common', hint: 'Setup present, little confluence.', short: 'Common' },
  Magic: { tier: 'Magic', hint: 'Setup plus one alignment.', short: 'Magic' },
  Rare: { tier: 'Rare', hint: 'Multiple timeframes aligned.', short: 'Rare' },
  Epic: { tier: 'Epic', hint: 'Timeframes and DXY aligned.', short: 'Epic' },
  Legendary: { tier: 'Legendary', hint: 'Everything lines up. Take it.', short: 'Legendary' },
  Ascension: { tier: 'Ascension', hint: 'Beyond the ladder. A trade you will remember.', short: 'Ascension' },
};

export const QUALITY_LADDER = QUALITY_TIERS.map(tier => QUALITY_META[tier]);

/** Normalise a stored value so unknown text never breaks the badge. */
export function qualityOf(value: string | null | undefined): QualityTier | null {
  if (!value) return null;
  const match = QUALITY_TIERS.find(tier => tier.toLowerCase() === value.trim().toLowerCase());
  return match ?? null;
}

export function qualityClass(value: string | null | undefined): string {
  const tier = qualityOf(value);
  return tier ? `quality-${tier.toLowerCase()}` : 'quality-unrated';
}
