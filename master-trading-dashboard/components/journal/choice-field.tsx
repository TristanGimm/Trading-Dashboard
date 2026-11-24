'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { customOption } from '@/lib/trade-options';
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
  allowCustom = false,
}: {
  label: string;
  options: string[];
  values: string[];
  onChange: (next: string[]) => void;
  className?: string;
  /** Let the trader record a value the shared ladder does not contain. */
  allowCustom?: boolean;
}) {
  const [custom, setCustom] = useState('');
  const [extras, setExtras] = useState<string[]>([]);
  // Stored rows may contain a value the shared vocabulary did not know about
  // (an import, a custom value, or an older spelling). Show it as a selectable
  // chip so that editing the trade never silently drops it. Locally added
  // values stay visible even when they are toggled off again.
  const available = [...new Set([...options, ...extras, ...values])];

  const add = () => {
    const next = customOption(custom, available);
    if (!next) return;
    setExtras(previous => previous.includes(next) || options.includes(next) ? previous : [...previous, next]);
    if (!values.includes(next)) onChange([...values, next]);
    setCustom('');
  };

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
    {allowCustom && <div className="choice-custom">
      <input
        className="choice-custom-input"
        aria-label={`New ${label} value`}
        placeholder="Add value…"
        maxLength={80}
        value={custom}
        onChange={event => setCustom(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter') { event.preventDefault(); add(); }
          if (event.key === 'Escape') { event.stopPropagation(); setCustom(''); }
        }}
      />
      <button type="button" className="choice-custom-add" aria-label={`Add ${label}`} disabled={!custom.trim()} onClick={add}><Plus size={12}/></button>
    </div>}
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
  allowCustom = false,
}: {
  label: string;
  hint?: string;
  options: string[];
  values: string[];
  onChange: (next: string[]) => void;
  className?: string;
  allowCustom?: boolean;
}) {
  return <div className={cn('field choice-field', className)}>
    <span>{label}</span>
    <ChoiceChips label={label} options={options} values={values} onChange={onChange} allowCustom={allowCustom}/>
    {hint && <small>{hint}</small>}
  </div>;
}
