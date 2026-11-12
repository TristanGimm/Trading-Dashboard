'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, Pencil, X } from 'lucide-react';
import type { Trade } from '@/lib/types';
import { dateTimeInputToIso, isoToDateTimeInput } from '@/lib/datetime';
import { money, number } from '@/lib/format';
import { QUALITY_TIERS } from '@/lib/quality';
import { QualityBadge } from '@/components/quality-badge';
import { cn } from '@/lib/utils';

type FieldKind = 'text' | 'list' | 'number' | 'select' | 'datetime' | 'textarea';

type FieldKey =
  | 'dateTime' | 'exitTime' | 'account' | 'pair' | 'position' | 'netEur'
  | 'setup' | 'setupQuality' | 'algorithm' | 'sessionTime' | 'marketCondition'
  | 'entryTf' | 'tfAlign' | 'orderType' | 'rMultiple' | 'pnlPercent' | 'lotSize'
  | 'accountBalance' | 'mfe30m' | 'mae30m' | 'recordedOutcome' | 'outcomeTag' | 'learning';

type Field = {
  key: FieldKey;
  label: string;
  kind: FieldKind;
  apiKey: string;
  options?: { value: string; label: string }[];
  value: (trade: Trade, timeZone: string) => string;
  display: (trade: Trade, timeZone: string) => ReactNode;
  parse: (value: string, timeZone: string) => unknown;
};

function when(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return 'Unrecorded';
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return 'Unrecorded';
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(date);
}

function splitList(value: string): string[] {
  return [...new Set(value.split(',').map(part => part.trim()).filter(Boolean))];
}

function nullableText(value: string): string | null {
  return value.trim() || null;
}

function numeric(value: string, label: string): number | null {
  const text = value.trim().replace(',', '.');
  if (!text) return null;
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be a number.`);
  return parsed;
}

function dateValue(value: string, timeZone: string, label: string): string | null {
  if (!value.trim()) return null;
  const iso = dateTimeInputToIso(value, timeZone);
  if (!iso) throw new Error(`${label} is not a valid time in this timezone.`);
  return iso;
}

const missing = <span className="muted">Unrecorded</span>;

const FIELDS: Field[] = [
  {
    key: 'dateTime', label: 'Entry time', kind: 'datetime', apiKey: 'dateTime',
    value: (trade, timeZone) => isoToDateTimeInput(trade.dateTime, timeZone),
    display: (trade, timeZone) => when(trade.dateTime, timeZone),
    parse: (value, timeZone) => dateValue(value, timeZone, 'Entry time'),
  },
  {
    key: 'exitTime', label: 'Exit time', kind: 'datetime', apiKey: 'exitTime',
    value: (trade, timeZone) => isoToDateTimeInput(trade.exitTime ?? null, timeZone),
    display: (trade, timeZone) => when(trade.exitTime, timeZone),
    parse: (value, timeZone) => dateValue(value, timeZone, 'Exit time'),
  },
  {
    key: 'account', label: 'Account', kind: 'list', apiKey: 'account',
    value: trade => trade.account.join(', '),
    display: trade => trade.account.join(', ') || 'Untagged',
    parse: value => splitList(value),
  },
  {
    key: 'pair', label: 'Instrument', kind: 'text', apiKey: 'pair',
    value: trade => trade.pair ?? '',
    display: trade => trade.pair || missing,
    parse: nullableText,
  },
  {
    key: 'position', label: 'Direction', kind: 'select', apiKey: 'position',
    options: [{ value: '', label: 'Unrecorded' }, { value: 'Long', label: 'Long' }, { value: 'Short', label: 'Short' }],
    value: trade => trade.position ?? '',
    display: trade => trade.position || missing,
    parse: nullableText,
  },
  {
    key: 'netEur', label: 'Net P&L', kind: 'number', apiKey: 'netEur',
    value: trade => trade.netEur === null ? '' : String(trade.netEur),
    display: trade => trade.netEur === null ? missing : <span className={trade.netEur < 0 ? 'negative' : trade.netEur ? 'positive' : ''}>{money(trade.netEur)}</span>,
    parse: value => numeric(value, 'Net P&L'),
  },
  {
    key: 'setup', label: 'Setup', kind: 'list', apiKey: 'setup',
    value: trade => trade.setup.join(', '),
    display: trade => trade.setup.length ? trade.setup.join(', ') : missing,
    parse: value => splitList(value),
  },
  {
    key: 'setupQuality', label: 'Setup quality', kind: 'select', apiKey: 'setupQuality',
    options: [{ value: '', label: 'Unrated' }, ...QUALITY_TIERS.map(tier => ({ value: tier, label: tier }))],
    value: trade => trade.setupQuality ?? '',
    display: trade => <QualityBadge value={trade.setupQuality} size="sm"/>,
    parse: nullableText,
  },
  {
    key: 'algorithm', label: 'Algorithm', kind: 'list', apiKey: 'algorithm',
    value: trade => trade.algorithm.join(', '),
    display: trade => trade.algorithm.length ? trade.algorithm.join(', ') : missing,
    parse: value => splitList(value),
  },
  {
    key: 'sessionTime', label: 'Session', kind: 'list', apiKey: 'sessionTime',
    value: trade => trade.sessionTime.join(', '),
    display: trade => trade.sessionTime.length ? trade.sessionTime.join(', ') : missing,
    parse: value => splitList(value),
  },
  {
    key: 'marketCondition', label: 'Market condition', kind: 'list', apiKey: 'marketCondition',
    value: trade => (trade.marketCondition ?? []).join(', '),
    display: trade => (trade.marketCondition ?? []).length ? (trade.marketCondition ?? []).join(', ') : missing,
    parse: value => splitList(value),
  },
  {
    key: 'entryTf', label: 'Entry TF', kind: 'list', apiKey: 'entryTf',
    value: trade => (trade.entryTf ?? []).join(', '),
    display: trade => (trade.entryTf ?? []).length ? (trade.entryTf ?? []).join(', ') : missing,
    parse: value => splitList(value),
  },
  {
    key: 'tfAlign', label: 'TF align', kind: 'list', apiKey: 'tfAlign',
    value: trade => (trade.tfAlign ?? []).join(', '),
    display: trade => (trade.tfAlign ?? []).length ? (trade.tfAlign ?? []).join(', ') : missing,
    parse: value => splitList(value),
  },
  {
    key: 'orderType', label: 'Order type', kind: 'select', apiKey: 'orderType',
    options: [{ value: '', label: 'Unrecorded' }, { value: 'Market', label: 'Market' }, { value: 'Limit', label: 'Limit' }],
    value: trade => trade.orderType ?? '',
    display: trade => trade.orderType || missing,
    parse: nullableText,
  },
  {
    key: 'rMultiple', label: 'R multiple', kind: 'number', apiKey: 'rMultiple',
    value: trade => trade.rMultiple === null ? '' : String(trade.rMultiple),
    display: trade => trade.rMultiple === null ? missing : `${number(trade.rMultiple)}R`,
    parse: value => numeric(value, 'R multiple'),
  },
  {
    key: 'pnlPercent', label: 'PnL %', kind: 'number', apiKey: 'pnlPercent',
    value: trade => trade.pnlPercent == null ? '' : String(trade.pnlPercent),
    display: trade => trade.pnlPercent == null ? missing : `${number(trade.pnlPercent)}%`,
    parse: value => numeric(value, 'PnL %'),
  },
  {
    key: 'lotSize', label: 'Lot size', kind: 'number', apiKey: 'lotSize',
    value: trade => trade.lotSize == null ? '' : String(trade.lotSize),
    display: trade => trade.lotSize == null ? missing : number(trade.lotSize),
    parse: value => numeric(value, 'Lot size'),
  },
  {
    key: 'accountBalance', label: 'Account balance', kind: 'number', apiKey: 'accountBalance',
    value: trade => trade.accountBalance === null ? '' : String(trade.accountBalance),
    display: trade => trade.accountBalance === null ? missing : money(trade.accountBalance),
    parse: value => numeric(value, 'Account balance'),
  },
  {
    key: 'mfe30m', label: 'MFE (30 min)', kind: 'number', apiKey: 'mfe30m',
    value: trade => trade.mfe30m == null ? '' : String(trade.mfe30m),
    display: trade => trade.mfe30m == null ? missing : number(trade.mfe30m),
    parse: value => numeric(value, 'MFE'),
  },
  {
    key: 'mae30m', label: 'MAE (30 min)', kind: 'number', apiKey: 'mae30m',
    value: trade => trade.mae30m == null ? '' : String(trade.mae30m),
    display: trade => trade.mae30m == null ? missing : number(trade.mae30m),
    parse: value => numeric(value, 'MAE'),
  },
  {
    key: 'recordedOutcome', label: 'Recorded outcome', kind: 'select', apiKey: 'recordedOutcome',
    options: [{ value: '', label: 'Derived from Net P&L' }, { value: 'win', label: 'Win' }, { value: 'loss', label: 'Loss' }, { value: 'breakeven', label: 'Break-even' }],
    value: trade => trade.recordedOutcome ?? '',
    display: trade => trade.recordedOutcome ? trade.recordedOutcome[0].toUpperCase() + trade.recordedOutcome.slice(1) : 'Derived from Net P&L',
    parse: nullableText,
  },
  {
    key: 'outcomeTag', label: 'Outcome tag', kind: 'select', apiKey: 'outcomeTag',
    options: [{ value: '', label: 'None' }, ...['Win', 'Small win', 'Loss', 'Small loss', 'B/E'].map(value => ({ value, label: value }))],
    value: trade => trade.outcomeTag ?? '',
    display: trade => trade.outcomeTag || missing,
    parse: nullableText,
  },
  {
    key: 'learning', label: 'Learning', kind: 'textarea', apiKey: 'learning',
    value: trade => trade.learning ?? '',
    display: trade => trade.learning
      ? <span className="fact-value-clamp" title={trade.learning}>{trade.learning}</span>
      : missing,
    parse: nullableText,
  },
];

/**
 * Notion-style properties: every value is a button. Click it, correct it, then
 * press Enter or the check mark. The PATCH is field-scoped, so two quick edits
 * cannot overwrite each other with a stale copy of the trade.
 */
export function EditableTradeFacts({ trade: initial, timeZone, variant = 'panel', exclude = [], onTradeChange }: {
  trade: Trade;
  timeZone: string;
  variant?: 'panel' | 'dialog';
  exclude?: FieldKey[];
  onTradeChange?: (trade: Trade) => void;
}) {
  const router = useRouter();
  const [trade, setTrade] = useState(initial);
  const [editing, setEditing] = useState<FieldKey | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState<FieldKey | null>(null);
  const [saved, setSaved] = useState<FieldKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const editor = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>(null);

  useEffect(() => {
    setTrade(initial);
    setEditing(null);
    setError(null);
  }, [initial.id]);

  useEffect(() => {
    if (!editing) return;
    const frame = requestAnimationFrame(() => {
      editor.current?.focus();
      if (editor.current instanceof HTMLInputElement || editor.current instanceof HTMLTextAreaElement) {
        editor.current.select();
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [editing]);

  const fields = FIELDS.filter(field => !exclude.includes(field.key));

  const start = (field: Field) => {
    setEditing(field.key);
    setDraft(field.value(trade, timeZone));
    setSaved(null);
    setError(null);
  };

  const cancel = () => {
    setEditing(null);
    setError(null);
  };

  const save = async (field: Field, value: string) => {
    if (saving) return;
    setError(null);
    try {
      const parsed = field.parse(value, timeZone);
      setSaving(field.key);
      const patch = field.apiKey === 'dateTime'
        ? { dateTime: parsed, timeRecorded: Boolean(value.trim()) }
        : { [field.apiKey]: parsed };
      const response = await fetch(`/api/trades/${trade.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const payload = await response.json().catch(() => ({})) as { trade?: Trade; error?: string };
      if (!response.ok || !payload.trade) throw new Error(payload.error || 'Could not save this property.');
      setTrade(payload.trade);
      onTradeChange?.(payload.trade);
      setEditing(null);
      setSaved(field.key);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save this property.');
    } finally {
      setSaving(null);
    }
  };

  return <>
    <dl className={cn('facts-list', 'editable-facts', variant === 'dialog' && 'detail-grid', variant === 'dialog' && 'editable-facts-dialog')}>
      {fields.map(field => {
        const isEditing = editing === field.key;
        return <div key={field.key} className={cn('fact-row', field.kind === 'textarea' && 'fact-row-wide', isEditing && 'is-editing')}>
          <dt>{field.label}</dt>
          <dd>
            {isEditing ? <div className="fact-editor">
              {field.kind === 'select'
                ? <select
                    ref={element => { editor.current = element; }}
                    className="fact-input"
                    aria-label={field.label}
                    value={draft}
                    onChange={event => { setDraft(event.target.value); void save(field, event.target.value); }}
                    onKeyDown={event => { if (event.key === 'Escape') cancel(); }}
                  >
                    {field.options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                : field.kind === 'textarea'
                  ? <textarea
                      ref={element => { editor.current = element; }}
                      className="fact-input"
                      aria-label={field.label}
                      rows={3}
                      value={draft}
                      onChange={event => setDraft(event.target.value)}
                      onKeyDown={event => {
                        if (event.key === 'Escape') { event.preventDefault(); cancel(); }
                        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); void save(field, draft); }
                      }}
                    />
                  : <input
                      ref={element => { editor.current = element; }}
                      className="fact-input"
                      aria-label={field.label}
                      type={field.kind === 'datetime' ? 'datetime-local' : 'text'}
                      inputMode={field.kind === 'number' ? 'decimal' : undefined}
                      value={draft}
                      onChange={event => setDraft(event.target.value)}
                      onKeyDown={event => {
                        if (event.key === 'Escape') { event.preventDefault(); cancel(); }
                        if (event.key === 'Enter') { event.preventDefault(); void save(field, draft); }
                      }}
                    />}
              {field.kind !== 'select' && <div className="fact-editor-actions">
                <button type="button" className="fact-check" aria-label={`Save ${field.label}`} disabled={saving === field.key} onClick={() => void save(field, draft)}>
                  {saving === field.key ? <Loader2 size={12} className="animate-spin"/> : <Check size={12}/>}
                </button>
                <button type="button" aria-label={`Cancel editing ${field.label}`} onClick={cancel}><X size={12}/></button>
              </div>}
            </div>
            : <button type="button" className="fact-value" aria-label={`Edit ${field.label.toLowerCase()}`} onClick={() => start(field)}>
              <span className="fact-value-text">{field.display(trade, timeZone)}</span>
              {saved === field.key ? <span className="fact-saved">Saved</span> : <Pencil size={11} className="fact-pencil"/>}
            </button>}
          </dd>
        </div>;
      })}
    </dl>
    {error && <p className="fact-error" role="alert">{error}</p>}
  </>;
}
