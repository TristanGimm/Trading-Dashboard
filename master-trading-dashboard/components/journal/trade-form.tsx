'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Loader2, Save, Trash2 } from 'lucide-react';
import type { Trade } from '@/lib/types';
import type { Block, WorkspacePage } from '@/lib/workspace-types';
import { dateTimeInputToIso, isoToDateTimeInput } from '@/lib/datetime';
import { ScreenshotField, imagesFromClipboard, screenshotValidationError, type PendingScreenshot } from '@/components/journal/screenshot-field';

type FormState = {
  tradeId: string;
  tradeNumber: string;
  account: string;
  dateTime: string;
  pair: string;
  position: string;
  netEur: string;
  accountBalance: string;
  rMultiple: string;
  recordedOutcome: string;
  setup: string;
  tfType: string;
  algorithm: string;
  sessionTime: string;
  liquiditySweep: boolean;
  dxy: boolean;
  delta: boolean;
  fractalShift: boolean;
  mfe30m: string;
  mae30m: string;
  setupQuality: string;
  marketCondition: string;
  entryTf: string;
  tfAlign: string;
  orderType: string;
  lotSize: string;
  pnlPercent: string;
  learning: string;
  outcomeTag: string;
  exitTime: string;
  analysisNote: string;
  note: string;
};

function initialState(trade: Trade | undefined, timeZone: string, now: string): FormState {
  return {
    tradeId: trade?.tradeId || '',
    tradeNumber: trade?.tradeNumber ? String(trade.tradeNumber) : '',
    account: trade?.account.join(', ') || 'Forwardtesting',
    dateTime: isoToDateTimeInput(trade ? trade.dateTime : now, timeZone),
    pair: trade?.pair || '',
    position: trade?.position || '',
    netEur: trade?.netEur === null || trade?.netEur === undefined ? '' : String(trade.netEur),
    accountBalance: trade?.accountBalance === null || trade?.accountBalance === undefined ? '' : String(trade.accountBalance),
    rMultiple: trade?.rMultiple === null || trade?.rMultiple === undefined ? '' : String(trade.rMultiple),
    recordedOutcome: trade?.recordedOutcome || '',
    setup: trade?.setup.join(', ') || '',
    tfType: trade?.tfType.join(', ') || '',
    algorithm: trade?.algorithm.join(', ') || '',
    sessionTime: trade?.sessionTime.join(', ') || '',
    liquiditySweep: trade?.liquiditySweep || false,
    dxy: trade?.dxy || false,
    delta: trade?.delta || false,
    fractalShift: trade?.fractalShift || false,
    mfe30m: trade?.mfe30m === null || trade?.mfe30m === undefined ? '' : String(trade.mfe30m),
    mae30m: trade?.mae30m === null || trade?.mae30m === undefined ? '' : String(trade.mae30m),
    setupQuality: trade?.setupQuality || '',
    marketCondition: trade?.marketCondition?.join(', ') || '',
    entryTf: trade?.entryTf?.join(', ') || '',
    tfAlign: trade?.tfAlign?.join(', ') || '',
    orderType: trade?.orderType || '',
    lotSize: trade?.lotSize === null || trade?.lotSize === undefined ? '' : String(trade.lotSize),
    pnlPercent: trade?.pnlPercent === null || trade?.pnlPercent === undefined ? '' : String(trade.pnlPercent),
    learning: trade?.learning || '',
    outcomeTag: trade?.outcomeTag || '',
    exitTime: isoToDateTimeInput(trade?.exitTime ?? null, timeZone),
    analysisNote: trade?.analysisNote || '',
    note: '',
  };
}

function list(value: string): string[] {
  return [...new Set(value.split(',').map(item => item.trim()).filter(Boolean))];
}

function numeric(value: string, label: string): number | null {
  if (!value.trim()) return null;
  const number = Number(value.replace(',', '.'));
  if (!Number.isFinite(number)) throw new Error(`${label} must be a number.`);
  return number;
}

export function TradeForm({ trade, timeZone, now }: { trade?: Trade; timeZone: string; now: string }) {
  const router = useRouter();
  const mode = trade ? 'edit' : 'create';
  const [form, setForm] = useState<FormState>(() => initialState(trade, timeZone, now));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [screenshots, setScreenshots] = useState<PendingScreenshot[]>([]);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);
  // A trade is committed before its screenshots are uploaded. Keeping the id
  // means a failed upload can be retried without creating a duplicate trade.
  const [createdTrade, setCreatedTrade] = useState<{ id: string; tradeId: string; pageId: string | null } | null>(null);
  const screenshotsRef = useRef(screenshots);
  const uploadedScreenshots = useRef(new Set<string>());

  useEffect(() => { screenshotsRef.current = screenshots; }, [screenshots]);
  useEffect(() => () => {
    for (const screenshot of screenshotsRef.current) URL.revokeObjectURL(screenshot.url);
  }, []);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm(previous => ({ ...previous, [key]: value }));

  const addScreenshots = (files: File[]) => {
    if (pending) return;
    const images = files.filter(file => file.type.startsWith('image/'));
    if (!images.length) return;
    const validation = screenshotValidationError(images);
    if (validation) { setScreenshotError(validation); return; }
    setScreenshotError(null);
    setScreenshots(previous => [
      ...previous,
      ...images.map(file => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file) })),
    ]);
  };

  const removeScreenshot = (id: string) => {
    setScreenshots(previous => {
      const removed = previous.find(screenshot => screenshot.id === id);
      if (removed) URL.revokeObjectURL(removed.url);
      return previous.filter(screenshot => screenshot.id !== id);
    });
  };

  const onPaste = (event: React.ClipboardEvent<HTMLFormElement>) => {
    if (pending) return;
    const files = imagesFromClipboard(event.clipboardData);
    if (!files.length) return;
    event.preventDefault();
    addScreenshots(files);
  };

  const appendScreenshot = async (pageId: string, assetId: string, name: string) => {
    const pageResponse = await fetch(`/api/pages/${pageId}`);
    const pagePayload = await pageResponse.json().catch(() => ({})) as { page?: WorkspacePage; error?: string };
    if (!pageResponse.ok || !pagePayload.page) throw new Error(pagePayload.error || 'Could not open the trade notes page.');
    const blocks: Block[] = [
      ...pagePayload.page.content.blocks,
      { id: crypto.randomUUID(), type: 'image', text: '', assetId, caption: name },
    ];
    const response = await fetch(`/api/pages/${pageId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: { blocks } }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(payload.error || 'Could not attach the screenshot to the trade.');
    }
  };

  const uploadPendingScreenshots = async (pageId: string) => {
    for (const screenshot of screenshotsRef.current) {
      if (uploadedScreenshots.current.has(screenshot.id)) continue;
      const body = new FormData();
      body.set('pageId', pageId);
      body.set('file', screenshot.file);
      const response = await fetch('/api/assets', { method: 'POST', body });
      const payload = await response.json().catch(() => ({})) as { asset?: { id: string }; error?: string };
      if (!response.ok || !payload.asset) {
        throw new Error(payload.error || `Could not upload ${screenshot.file.name || 'the screenshot'}.`);
      }
      try {
        await appendScreenshot(pageId, payload.asset.id, screenshot.file.name || 'Screenshot');
      } catch (reason) {
        // Do not leave an uploaded file with no image block pointing at it.
        await fetch(`/api/assets/${payload.asset.id}`, { method: 'DELETE' }).catch(() => {});
        throw reason;
      }
      uploadedScreenshots.current.add(screenshot.id);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending) return;
    setError(null);
    try {
      const dateTime = dateTimeInputToIso(form.dateTime, timeZone);
      if (form.dateTime && !dateTime) throw new Error('Entry time is not valid in your timezone.');
      const payload = {
        tradeId: form.tradeId.trim() || undefined,
        tradeNumber: form.tradeNumber.trim() ? Number(form.tradeNumber) : null,
        account: list(form.account),
        dateTime,
        pair: form.pair.trim() || null,
        position: form.position || null,
        netEur: numeric(form.netEur, 'Net P&L'),
        accountBalance: numeric(form.accountBalance, 'Account balance'),
        rMultiple: numeric(form.rMultiple, 'R multiple'),
        recordedOutcome: form.recordedOutcome || null,
        setup: list(form.setup),
        tfType: list(form.tfType),
        algorithm: list(form.algorithm),
        sessionTime: list(form.sessionTime),
        liquiditySweep: form.liquiditySweep,
        dxy: form.dxy,
        delta: form.delta,
        fractalShift: form.fractalShift,
        mfe30m: numeric(form.mfe30m, 'MFE'),
        mae30m: numeric(form.mae30m, 'MAE'),
        setupQuality: form.setupQuality || null,
        marketCondition: list(form.marketCondition),
        entryTf: list(form.entryTf),
        tfAlign: list(form.tfAlign),
        orderType: form.orderType || null,
        lotSize: numeric(form.lotSize, 'Lot size'),
        pnlPercent: numeric(form.pnlPercent, 'PnL %'),
        learning: form.learning.trim() || null,
        outcomeTag: form.outcomeTag.trim() || null,
        timeRecorded: Boolean(form.dateTime),
        exitTime: dateTimeInputToIso(form.exitTime, timeZone),
        analysisNote: form.analysisNote.trim() || null,
        ...(mode === 'create' ? { note: form.note.trim() || undefined } : {}),
      };
      setPending(true);
      let saved = createdTrade;
      if (!saved) {
        const response = await fetch(mode === 'create' ? '/api/trades' : `/api/trades/${trade!.id}`, {
          method: mode === 'create' ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const result = await response.json().catch(() => ({})) as { trade?: Trade; pageId?: string | null; error?: string };
        if (!response.ok || !result.trade) throw new Error(result.error || 'Could not save the trade.');
        if (mode === 'create') {
          saved = { id: result.trade.id, tradeId: result.trade.tradeId, pageId: result.pageId ?? null };
          setCreatedTrade(saved);
        } else {
          router.push(`/journal/${result.trade.id}`);
          router.refresh();
          return;
        }
      } else {
        // A retry after a failed screenshot upload: keep edits made in the form.
        const response = await fetch(`/api/trades/${saved.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const result = await response.json().catch(() => ({})) as { trade?: Trade; error?: string };
        if (!response.ok || !result.trade) throw new Error(result.error || 'Could not save the trade.');
      }
      if (screenshotsRef.current.length) {
        if (!saved.pageId) throw new Error('The trade was saved, but its notes page could not be created. Open the trade and paste the screenshots there.');
        await uploadPendingScreenshots(saved.pageId);
      }
      router.push(`/journal/${saved.id}`);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save the trade.');
    } finally {
      setPending(false);
    }
  };

  const remove = async () => {
    if (!trade || !window.confirm(`Delete trade #${trade.tradeId} and its notes/screenshots?`)) return;
    setPending(true);
    try {
      const response = await fetch(`/api/trades/${trade.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Could not delete the trade.');
      router.push('/journal');
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not delete the trade.');
      setPending(false);
    }
  };

  const hasPendingScreenshots = screenshots.some(screenshot => !uploadedScreenshots.current.has(screenshot.id));
  const submitLabel = createdTrade
    ? hasPendingScreenshots ? 'Retry screenshots & open' : 'Open saved trade'
    : mode === 'create' ? 'Create trade' : 'Save changes';

  return <form className="trade-form" onSubmit={submit} onPaste={mode === 'create' ? onPaste : undefined}>
    {error && <div className="editor-error" role="alert"><AlertCircle size={14}/>{error}</div>}
    <section className="form-section">
      <div className="form-section-heading"><h3>Trade</h3><p>Identity, timing and instrument.</p></div>
      <div className="form-grid">
        <label className="field"><span>Trade ID</span><input className="form-input" value={form.tradeId} placeholder="Auto" onChange={event => update('tradeId', event.target.value)}/></label>
        <label className="field"><span>Trade number</span><input className="form-input" inputMode="numeric" value={form.tradeNumber} placeholder="Auto" onChange={event => update('tradeNumber', event.target.value)}/></label>
        <label className="field"><span>Entry time</span><input className="form-input" type="datetime-local" value={form.dateTime} onChange={event => update('dateTime', event.target.value)}/></label>
        <label className="field"><span>Exit time</span><input className="form-input" type="datetime-local" value={form.exitTime} onChange={event => update('exitTime', event.target.value)}/><small>Optional. Leave empty when not recorded.</small></label>
        <label className="field"><span>Account</span><input className="form-input" list="account-options" value={form.account} placeholder="Forwardtesting" onChange={event => update('account', event.target.value)}/><small>Separate multiple accounts with commas.</small></label>
        <label className="field"><span>Instrument</span><input className="form-input" list="pair-options" value={form.pair} placeholder="XAUUSD" onChange={event => update('pair', event.target.value)}/></label>
        <label className="field"><span>Direction</span><select className="form-input" value={form.position} onChange={event => update('position', event.target.value)}><option value="">Unrecorded</option><option>Long</option><option>Short</option></select></label>
      </div>
    </section>
    <section className="form-section">
      <div className="form-section-heading"><h3>Result</h3><p>Realized outcome and excursion data.</p></div>
      <div className="form-grid">
        <label className="field"><span>Net P&amp;L (€)</span><input className="form-input" inputMode="decimal" value={form.netEur} placeholder="e.g. 125.50" onChange={event => update('netEur', event.target.value)}/></label>
        <label className="field"><span>Account balance (€)</span><input className="form-input" inputMode="decimal" value={form.accountBalance} placeholder="Recorded balance" onChange={event => update('accountBalance', event.target.value)}/></label>
        <label className="field"><span>R multiple</span><input className="form-input" inputMode="decimal" value={form.rMultiple} placeholder="e.g. 1.8" onChange={event => update('rMultiple', event.target.value)}/></label>
        <label className="field"><span>Recorded outcome</span><select className="form-input" value={form.recordedOutcome} onChange={event => update('recordedOutcome', event.target.value)}><option value="">Derive from Net P&amp;L</option><option value="win">Win</option><option value="loss">Loss</option><option value="breakeven">Break-even</option></select></label>
        <label className="field"><span>MFE (30 min)</span><input className="form-input" inputMode="decimal" value={form.mfe30m} placeholder="Maximum favorable" onChange={event => update('mfe30m', event.target.value)}/></label>
        <label className="field"><span>MAE (30 min)</span><input className="form-input" inputMode="decimal" value={form.mae30m} placeholder="Maximum adverse" onChange={event => update('mae30m', event.target.value)}/></label>
        <label className="field"><span>PnL %</span><input className="form-input" inputMode="decimal" value={form.pnlPercent} placeholder="e.g. 2.52" onChange={event => update('pnlPercent', event.target.value)}/></label>
        <label className="field"><span>Lot size</span><input className="form-input" inputMode="decimal" value={form.lotSize} placeholder="e.g. 0.03" onChange={event => update('lotSize', event.target.value)}/></label>
        <label className="field"><span>Outcome tag</span><select className="form-input" value={form.outcomeTag} onChange={event => update('outcomeTag', event.target.value)}><option value="">None</option><option>Win</option><option>Small win</option><option>Loss</option><option>Small loss</option><option>B/E</option></select><small>The Notion-style granular tag, kept alongside the net result.</small></label>
      </div>
    </section>
    <section className="form-section">
      <div className="form-section-heading"><h3>Context</h3><p>Setups, sessions and timeframes. Separate values with commas.</p></div>
      <div className="form-grid">
        <label className="field"><span>Setup</span><input className="form-input" list="setup-options" value={form.setup} placeholder="LTF Reversal, Liquidity Sweep" onChange={event => update('setup', event.target.value)}/></label>
        <label className="field"><span>Session</span><input className="form-input" list="session-options" value={form.sessionTime} placeholder="London, New York" onChange={event => update('sessionTime', event.target.value)}/></label>
        <label className="field"><span>TF Type</span><input className="form-input" list="tf-options" value={form.tfType} placeholder="1m Type 3, 5s Type 3" onChange={event => update('tfType', event.target.value)}/></label>
        <label className="field"><span>Algorithm</span><input className="form-input" list="algorithm-options" value={form.algorithm} placeholder="CBR, CBC" onChange={event => update('algorithm', event.target.value)}/></label>
        <label className="field"><span>Setup Quality</span><select className="form-input" value={form.setupQuality} onChange={event => update('setupQuality', event.target.value)}><option value="">Unrated</option><option>Common</option><option>Magic</option><option>Rare</option><option>Epic</option><option>Legendary</option><option>Ascension</option></select></label>
        <label className="field"><span>Order type</span><select className="form-input" value={form.orderType} onChange={event => update('orderType', event.target.value)}><option value="">Unrecorded</option><option>Market</option><option>Limit</option></select></label>
        <label className="field"><span>Entry TF</span><input className="form-input" list="tf-values" value={form.entryTf} placeholder="1m, 5m, 1h" onChange={event => update('entryTf', event.target.value)}/></label>
        <label className="field"><span>TF Align</span><input className="form-input" list="tf-values" value={form.tfAlign} placeholder="15m, 1h, 4h" onChange={event => update('tfAlign', event.target.value)}/></label>
        <label className="field"><span>Market Condition</span><input className="form-input" list="condition-options" value={form.marketCondition} placeholder="Bullish, Ranging" onChange={event => update('marketCondition', event.target.value)}/></label>
      </div>
      <div className="checkbox-row">
        {([['liquiditySweep', 'Liquidity sweep'], ['dxy', 'DXY confirmation'], ['delta', 'Delta'], ['fractalShift', 'Fractal shift']] as const).map(([key, label]) => <label key={key} className="checkbox-field"><input type="checkbox" checked={form[key]} onChange={event => update(key, event.target.checked)}/><span>{label}</span></label>)}
      </div>
    </section>
    <section className="form-section">
      <div className="form-section-heading"><h3>Review</h3><p>What did this trade teach you, and where is the chart?</p></div>
      <div className="form-grid">
        <label className="field"><span>Learning</span><textarea className="form-input form-textarea" rows={3} value={form.learning} placeholder="Random trading. Became greedy. Against trend." onChange={event => update('learning', event.target.value)}/></label>
        <label className="field"><span>Analysis reference</span><textarea className="form-input form-textarea" rows={3} value={form.analysisNote} placeholder="Path or note about the screenshot" onChange={event => update('analysisNote', event.target.value)}/><small>Screenshots belong on the trade page — paste them there with ⌘V.</small></label>
      </div>
    </section>
    {mode === 'create' && <section className="form-section">
      <div className="form-section-heading"><h3>Screenshots</h3><p>Paste chart images with ⌘V / Ctrl+V, or drop them here. They upload when you create the trade.</p></div>
      <ScreenshotField images={screenshots} onAdd={addScreenshots} onRemove={removeScreenshot} disabled={pending}/>
      {screenshotError && <div className="editor-error" role="alert"><AlertCircle size={14}/>{screenshotError}</div>}
    </section>}
    {mode === 'create' && <section className="form-section">
      <div className="form-section-heading"><h3>First note</h3><p>Optional. The screenshots above are added to the same trade notes page.</p></div>
      <label className="field"><span>Note</span><textarea className="form-input form-textarea" rows={4} value={form.note} placeholder="What did you see? What did you execute?" onChange={event => update('note', event.target.value)}/></label>
    </section>}
    <div className="form-actions">
      <button type="submit" className="button button-primary" disabled={pending}>{pending ? <Loader2 size={13} className="animate-spin"/> : <Save size={13}/>}{submitLabel}</button>
      <button type="button" className="button" disabled={pending} onClick={() => router.back()}>Cancel</button>
      {mode === 'edit' && <button type="button" className="button button-danger" disabled={pending} onClick={remove}><Trash2 size={13}/>Delete trade</button>}
    </div>
    <datalist id="account-options"><option value="Forwardtesting"/><option value="Backtest"/></datalist>
    <datalist id="pair-options">{['XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'NAS100', 'US30', 'BTCUSD'].map(value => <option key={value} value={value}/>)}</datalist>
    <datalist id="setup-options">{['LTF Reversal', 'LTF Continuation', 'HTF Reversal', 'HTF Continuation', 'Liquidity Sweep', 'Breakout'].map(value => <option key={value} value={value}/>)}</datalist>
    <datalist id="session-options">{['Asia', 'London', 'New York', 'London / New York'].map(value => <option key={value} value={value}/>)}</datalist>
    <datalist id="tf-options">{['1m Type 3', '5s Type 3', '5m Type 1', '15m Type 2', '1hr Type 3', '4hr Type 3'].map(value => <option key={value} value={value}/>)}</datalist>
    <datalist id="tf-values">{['5s', '1m', '5m', '15m', '30m', '1h', '4h'].map(value => <option key={value} value={value}/>)}</datalist>
    <datalist id="algorithm-options">{['CBR', 'CBC', 'Stocks'].map(value => <option key={value} value={value}/>)}</datalist>
    <datalist id="condition-options">{['Bullish', 'Bearish', 'Ranging', 'Bullish Ranging', 'Bearish Ranging'].map(value => <option key={value} value={value}/>)}</datalist>
  </form>;
}
