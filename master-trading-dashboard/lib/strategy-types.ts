/**
 * Shared strategy types and constants.
 * Kept free of database imports so client components can use them.
 */
export type StrategyItem = { id: string; text: string; done: boolean };

export type StrategyCard = {
  id: string;
  title: string;
  icon: string;
  tone: string;
  kind: 'list' | 'checklist';
  intro: string;
  items: StrategyItem[];
};

export type StrategySession = { id: string; label: string; winter: string; summer: string };

export type StrategyDefinition = { id: string; label: string; text: string };

export type StrategyBoard = {
  headline: string;
  subline: string;
  cards: StrategyCard[];
  patterns: StrategyCard[];
  sessions: StrategySession[];
  definitions: StrategyDefinition[];
  updatedAt: string | null;
};

export const STRATEGY_ICONS = [
  'compass', 'clock', 'sparkles', 'crosshair', 'shield', 'target',
  'gauge', 'trending', 'list', 'flame', 'crown', 'gem',
] as const;

export const STRATEGY_TONES = ['indigo', 'green', 'purple', 'pink', 'red', 'amber', 'teal', 'slate', 'lime', 'cyan'] as const;

