import { cn } from '@/lib/utils';
import {
  algorithmTone, conditionTone, sessionTone, setupTone, timeframeHint, timeframeTone,
  type TagTone,
} from '@/lib/tags';

/**
 * One tag shape for every journal value. The tone class carries the colour;
 * the base `.data-tag` carries the box, so a tag never renders as bare text.
 */
export function DataTag({ value, tone, title, className }: {
  value: string;
  tone: TagTone;
  title?: string;
  className?: string;
}) {
  return <span className={cn('data-tag', `tone-${tone}`, className)} title={title ?? value}>{value}</span>;
}

export function AlgorithmTag({ value }: { value: string }) {
  return <DataTag value={value} tone={algorithmTone(value)}/>;
}

export function SetupTag({ value }: { value: string }) {
  return <DataTag value={value} tone={setupTone(value)}/>;
}

export function ConditionTag({ value }: { value: string }) {
  return <DataTag value={value} tone={conditionTone(value)}/>;
}

export function SessionTag({ value }: { value: string }) {
  return <DataTag value={value} tone={sessionTone(value)}/>;
}

export function TimeframeTag({ value }: { value: string }) {
  return <DataTag value={value} tone={timeframeTone(value)} title={timeframeHint(value)}/>;
}
