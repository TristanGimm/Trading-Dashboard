'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowRight, Check, Loader2, X } from 'lucide-react';
import type { Trade } from '@/lib/types';
import { money, pnlPercentLabel, pnlPercentOf } from '@/lib/format';
import { QualityBadge } from '@/components/quality-badge';
import { PnlRing } from '@/components/journal/marks';
import { AlgorithmTag, ConditionTag, SessionTag, SetupTag, TimeframeTag } from '@/components/journal/tags';
import { EditableTradeFacts } from '@/components/journal/editable-trade-facts';
import { TradeScreenshots } from '@/components/journal/trade-screenshots';
import { cn } from '@/lib/utils';

type Draft = {
  recordedOutcome: '' | 'win' | 'loss' | 'breakeven';
  outcomeTag: string;
  liquiditySweep: boolean;
  dxy: boolean;
  delta: boolean;
  fractalShift: boolean;
  lotSize: string;
  rMultiple: string;
  netEur: string;
  setupQuality: string;
};

const CONFLUENCES = [
  { key: 'liquiditySweep', label: 'Liquidity Sweep' },
  { key: 'dxy', label: 'DXY' },
  { key: 'delta', label: 'Delta' },
  { key: 'fractalShift', label: 'Fractal Shift' },
] as const;

function draftOf(trade: Trade): Draft {
  return {
    recordedOutcome: trade.recordedOutcome ?? '',
    outcomeTag: trade.outcomeTag ?? '',
    liquiditySweep: trade.liquiditySweep,
    dxy: trade.dxy,
    delta: trade.delta,
    fractalShift: trade.fractalShift,
    lotSize: trade.lotSize === null || trade.lotSize === undefined ? '' : String(trade.lotSize),
    rMultiple: trade.rMultiple === null ? '' : String(trade.rMultiple),
    netEur: trade.netEur === null ? '' : String(trade.netEur),
    setupQuality: trade.setupQuality ?? '',
  };
}

function toNumber(value: string): number | null {
  const text = value.trim().replace(',', '.');
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

export function TradeDetail({ trade, timeZone, demo, onClose }: { trade: Trade | null; timeZone: string; demo: boolean; onClose: () => void }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [live, setLive] = useState<Trade | null>(trade);
  const [draft, setDraft] = useState<Draft | null>(null);
  // What the server currently holds, so "dirty" does not depend on a refresh.
  const [baseline, setBaseline] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-seed only when a different trade opens. Depending on the whole object
  // meant that a router.refresh() after saving reset the form and dropped the
  // "Saved" confirmation.
  const tradeId = trade?.id ?? null;
  useEffect(() => {
    setLive(trade);
    if (!trade) {
      dialog.current?.close();
      return;
    }
    dialog.current?.showModal();
    const seeded = draftOf(trade);
    setDraft(seeded);
    setBaseline(seeded);
    setSaved(false);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tradeId]);

  useEffect(() => {
    if (!trade) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [trade]);

  if (!trade) return <dialog ref={dialog} className="detail-dialog" aria-labelledby="trade-detail-title" onClose={onClose}/>;

  const dirty = draft !== null && baseline !== null && JSON.stringify(draft) !== JSON.stringify(baseline);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft(previous => previous ? { ...previous, [key]: value } : previous);
    setSaved(false);
  };

  const save = async () => {
    if (!draft || saving) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/trades/${trade.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordedOutcome: draft.recordedOutcome || null,
          outcomeTag: draft.outcomeTag.trim() || null,
          liquiditySweep: draft.liquiditySweep,
          dxy: draft.dxy,
          delta: draft.delta,
          fractalShift: draft.fractalShift,
          lotSize: toNumber(draft.lotSize),
          rMultiple: toNumber(draft.rMultiple),
          netEur: toNumber(draft.netEur),
          setupQuality: draft.setupQuality || null,
        }),
      });
      const payload = await response.json().catch(() => ({})) as { trade?: Trade; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Could not save the trade.');
      if (payload.trade) setLive(payload.trade);
      setBaseline(draft);
      setSaved(true);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save the trade.');
    } finally {
      setSaving(false);
    }
  };

  const view = live && live.id === trade.id ? live : trade;
  const draftPnlPercent = pnlPercentOf(draft ? toNumber(draft.netEur) : view.netEur, view.accountBalance);
  const confluences = [view.liquiditySweep && 'Liquidity sweep', view.dxy && 'DXY confirmation', view.delta && 'Delta', view.fractalShift && 'Fractal shift', ...view.tfType].filter((value): value is string => Boolean(value));

  return <dialog ref={dialog} className="detail-dialog detail-dialog-editable" aria-labelledby="trade-detail-title" onCancel={onClose} onClose={onClose} onClick={event => { if (event.target === dialog.current) { const bounds = dialog.current.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose(); } }}>
    <div className="dialog-heading">
      <div>
        <p className="eyebrow">{demo ? 'Sample trade' : 'Trade review'}</p>
        <h2 id="trade-detail-title">{view.pair || 'Trade'} <span className="muted">#{view.tradeId}</span></h2>
      </div>
      <button type="button" className="icon-button" aria-label="Close trade details" onClick={onClose}><X size={17}/></button>
    </div>
    <div className="dialog-body">
      <div className="dialog-result-row">
        <div>
          <p className="panel-subtitle">Realized net P&amp;L</p>
          <div className={`dialog-pnl ${view.netEur !== null && view.netEur < 0 ? 'negative' : view.netEur ? 'positive' : ''}`}>{view.netEur === null ? 'Unrecorded' : money(view.netEur)}</div>
        </div>
        <PnlRing percent={view.pnlPercent} size={64}/>
      </div>

      {error && <div className="editor-error" role="alert"><AlertCircle size={14}/>{error}</div>}

      {!demo && <TradeScreenshots trade={view}/>}

      {demo ? <p className="panel-subtitle">Synthetic sample for the local preview. Editing is disabled.</p> : <section className="dialog-section">
        <h3>Result</h3>
        <div className="outcome-switch" role="group" aria-label="Recorded outcome">
          {([['win', 'Win'], ['loss', 'Loss'], ['breakeven', 'B/E']] as const).map(([value, label]) => <button
            key={value}
            type="button"
            aria-pressed={draft?.recordedOutcome === value}
            className={cn(draft?.recordedOutcome === value && 'selected', value)}
            onClick={() => set('recordedOutcome', draft?.recordedOutcome === value ? '' : value)}
          >{draft?.recordedOutcome === value && <Check size={11}/>}{label}</button>)}
        </div>
        <div className="dialog-grid-3">
          <label className="field"><span>Net €</span><input className="form-input" inputMode="decimal" value={draft?.netEur ?? ''} onChange={event => set('netEur', event.target.value)}/></label>
          <label className="field"><span>PnL % <em className="field-badge">auto</em></span><input className="form-input computed-input" value={pnlPercentLabel(draftPnlPercent)} readOnly tabIndex={-1} aria-readonly="true"/></label>
          <label className="field"><span>R</span><input className="form-input" inputMode="decimal" value={draft?.rMultiple ?? ''} onChange={event => set('rMultiple', event.target.value)}/></label>
          <label className="field"><span>Lot size</span><input className="form-input" inputMode="decimal" value={draft?.lotSize ?? ''} onChange={event => set('lotSize', event.target.value)} placeholder="0.03"/></label>
          <label className="field"><span>Outcome tag</span><select className="form-input" value={draft?.outcomeTag ?? ''} onChange={event => set('outcomeTag', event.target.value)}><option value="">None</option><option>Win</option><option>Small win</option><option>Loss</option><option>Small loss</option><option>B/E</option></select></label>
          <label className="field"><span>Quality</span><select className="form-input" value={draft?.setupQuality ?? ''} onChange={event => set('setupQuality', event.target.value)}><option value="">Unrated</option><option>Common</option><option>Magic</option><option>Rare</option><option>Epic</option><option>Legendary</option><option>Ascension</option></select></label>
        </div>
      </section>}

      <section className="dialog-section">
        <h3>Confluences</h3>
        <div className="confluence-grid">
          {CONFLUENCES.map(item => {
            const active = draft ? draft[item.key] : trade[item.key];
            return <button
              key={item.key}
              type="button"
              className={cn('confluence-toggle', active && 'is-on')}
              aria-pressed={active}
              disabled={demo}
              onClick={() => set(item.key, !active)}
            >
              <span className="confluence-box" aria-hidden="true">{active && <Check size={10}/>}</span>
              {item.label}
            </button>;
          })}
        </div>
        {view.tfType.length > 0 && <div className="confluence-tags">{view.tfType.map(value => <TimeframeTag key={value} value={value}/>)}</div>}
      </section>

      <EditableTradeFacts
        trade={view}
        timeZone={timeZone}
        variant="dialog"
        exclude={['recordedOutcome', 'outcomeTag', 'setupQuality', 'netEur', 'pnlPercent', 'rMultiple', 'lotSize']}
        onTradeChange={setLive}
      />

      <div className="dialog-marks">
        {view.setupQuality && <QualityBadge value={view.setupQuality}/>}
        {view.setup.map(value => <SetupTag key={value} value={value}/>)}
        {view.algorithm.map(value => <AlgorithmTag key={value} value={value}/>)}
        {view.sessionTime.map(value => <SessionTag key={value} value={value}/>)}
        {(view.marketCondition ?? []).map(value => <ConditionTag key={value} value={value}/>)}
      </div>

      {view.learning && <><p className="panel-subtitle">Learning</p><p className="detail-learning">{view.learning}</p></>}

      {!demo && <div className="dialog-actions">
        <button type="button" className="button button-primary" onClick={save} disabled={!dirty || saving}>
          {saving ? <Loader2 size={13} className="animate-spin"/> : saved ? <Check size={13}/> : null}
          {saved && !dirty ? 'Saved' : 'Save changes'}
        </button>
        <Link className="button" href={`/journal/${trade.id}`}>Open trade page<ArrowRight size={13}/></Link>
      </div>}
    </div>
  </dialog>;
}
