import { Circle, Crown, Flame, Gem, Shield, Sparkles, type LucideIcon } from 'lucide-react';
import { qualityOf, type QualityTier } from '@/lib/quality';
import { cn } from '@/lib/utils';

const ICONS: Record<QualityTier, LucideIcon> = {
  Common: Circle,
  Magic: Sparkles,
  Rare: Gem,
  Epic: Shield,
  Legendary: Crown,
  Ascension: Flame,
};

/**
 * Titan Quest style rarity badge: grey, yellow, green, blue, purple, and a
 * prismatic tier above the ladder.
 */
export function QualityBadge({ value, size = 'md', showIcon = true, className }: {
  value: string | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}) {
  const tier = qualityOf(value);
  if (!tier) return <span className={cn('quality-tag quality-unrated', size !== 'md' && `quality-${size}`, className)}>Unrated</span>;
  const Icon = ICONS[tier];
  return <span className={cn('quality-tag', `quality-${tier.toLowerCase()}`, size !== 'md' && `quality-${size}`, className)} data-tier={tier}>
    {showIcon && <Icon size={size === 'sm' ? 10 : size === 'lg' ? 15 : 12} strokeWidth={2.4}/>}
    {tier}
  </span>;
}

export function QualityIcon({ value, size = 13 }: { value: string | null | undefined; size?: number }) {
  const tier = qualityOf(value);
  if (!tier) return null;
  const Icon = ICONS[tier];
  return <Icon size={size} strokeWidth={2.4}/>;
}
