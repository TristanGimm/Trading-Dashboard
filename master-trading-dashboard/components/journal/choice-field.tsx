'use client';

import { cn } from '@/lib/utils';

/**
 * A row of toggle chips. Every categorical journal field is edited with these
 * instead of a text input, so the only things a trader types are numbers and
 * deliberate prose.
 */
export function ChoiceChips({
  label,
  options,
  values,
  onChange,
  className,
}: {
  label: string;
  options: string[];
  values: string[];
  onChange: (next: string[]) => void;
  className?: string;
}) {
  // Stored rows may contain a value the shared vocabulary did not know about
  // (an import, or an older spelling). Show it as a selectable chip so that
  // editing the trade never silently drops it.
  const available = [...options, ...values.filter(value => !options.includes(value))];
  return <div className={cn('choice-grid', className)} role="group" aria-label={label}>
    {available.map(option => {
      const selected = values.includes(option);
      return <button
        key={option}
        type="button"
        className={cn('choice-chip', selected && 'is-selected')}
        aria-pressed={selected}
        onClick={() => onChange(selected ? values.filter(value => value !== option) : [...values, option])}
      >{option}</button>;
    })}
  </div>;
}

/** A labelled field wrapper for a chip group. */
export function ChoiceField({
  label,
  hint,
  options,
  values,
  onChange,
  className,
}: {
  label: string;
  hint?: string;
  options: string[];
  values: string[];
  onChange: (next: string[]) => void;
  className?: string;
}) {
  return <div className={cn('field choice-field', className)}>
    <span>{label}</span>
    <ChoiceChips label={label} options={options} values={values} onChange={onChange}/>
    {hint && <small>{hint}</small>}
  </div>;
}
