'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle, Check, Compass, Clock3, Crosshair, Crown, Flame, Gauge, Gem, ListChecks,
  Loader2, Plus, Shield, Sparkles, Target, Trash2, TrendingUp, X,
} from 'lucide-react';
import { QUALITY_LADDER } from '@/lib/quality';
import { QualityBadge } from '@/components/quality-badge';
import { STRATEGY_ICONS, STRATEGY_TONES, type StrategyBoard, type StrategyCard } from '@/lib/strategy-types';
import { cn } from '@/lib/utils';

const ICONS = {
  compass: Compass, clock: Clock3, sparkles: Sparkles, crosshair: Crosshair, shield: Shield,
  target: Target, gauge: Gauge, trending: TrendingUp, list: ListChecks, flame: Flame,
  crown: Crown, gem: Gem,
} as const;

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

function newItem() {
  return { id: crypto.randomUUID(), text: '', done: false };
}

export function StrategyEditor({ initial }: { initial: StrategyBoard }) {
  const [board, setBoard] = useState<StrategyBoard>(initial);
  const [status, setStatus] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(true);
  const dirty = useRef(false);
  const saving = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(board);

  useEffect(() => { latest.current = board; }, [board]);

  const save = useCallback(async () => {
    if (!dirty.current || saving.current) return;
    saving.current = true;
    dirty.current = false;
    setStatus('saving');
    setError(null);
    try {
      const response = await fetch('/api/strategy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(latest.current),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error || 'Could not save the strategy.');
      }
      setStatus(dirty.current ? 'dirty' : 'saved');
    } catch (reason) {
      dirty.current = true;
      setStatus('error');
      setError(reason instanceof Error ? reason.message : 'Could not save the strategy.');
    } finally {
      saving.current = false;
      if (dirty.current) timer.current = setTimeout(() => void save(), 2000);
    }
  }, []);

  const markDirty = useCallback(() => {
    dirty.current = true;
    setStatus('dirty');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), 900);
  }, [save]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const update = (patch: Partial<StrategyBoard>) => {
    setBoard(previous => ({ ...previous, ...patch }));
    markDirty();
  };

  const updateCard = (group: 'cards' | 'patterns', id: string, patch: Partial<StrategyCard>) => {
    setBoard(previous => ({
      ...previous,
      [group]: previous[group].map(card => card.id === id ? { ...card, ...patch } : card),
    }));
    markDirty();
  };

  const updateItem = (group: 'cards' | 'patterns', cardId: string, itemId: string, patch: Partial<{ text: string; done: boolean }>) => {
    setBoard(previous => ({
      ...previous,
      [group]: previous[group].map(card => card.id === cardId
        ? { ...card, items: card.items.map(entry => entry.id === itemId ? { ...entry, ...patch } : entry) }
        : card),
    }));
    markDirty();
  };

  const addItem = (group: 'cards' | 'patterns', cardId: string) => {
    setBoard(previous => ({
      ...previous,
      [group]: previous[group].map(card => card.id === cardId ? { ...card, items: [...card.items, newItem()] } : card),
    }));
    markDirty();
  };

  const removeItem = (group: 'cards' | 'patterns', cardId: string, itemId: string) => {
    setBoard(previous => ({
      ...previous,
      [group]: previous[group].map(card => card.id === cardId ? { ...card, items: card.items.filter(entry => entry.id !== itemId) } : card),
    }));
    markDirty();
  };

  const addCard = (group: 'cards' | 'patterns') => {
    setBoard(previous => ({
      ...previous,
      [group]: [...previous[group], {
        id: crypto.randomUUID(), title: 'New card', icon: 'compass', tone: 'slate',
        kind: 'list' as const, intro: '', items: [newItem()],
      }],
    }));
    markDirty();
  };

  const removeCard = (group: 'cards' | 'patterns', id: string) => {
    setBoard(previous => ({ ...previous, [group]: previous[group].filter(card => card.id !== id) }));
    markDirty();
  };

  const updateSession = (id: string, patch: Partial<{ label: string; winter: string; summer: string }>) => {
    setBoard(previous => ({ ...previous, sessions: previous.sessions.map(session => session.id === id ? { ...session, ...patch } : session) }));
    markDirty();
  };

  const updateDefinition = (id: string, patch: Partial<{ label: string; text: string }>) => {
    setBoard(previous => ({ ...previous, definitions: previous.definitions.map(entry => entry.id === id ? { ...entry, ...patch } : entry) }));
    markDirty();
  };

  const addDefinition = () => {
    setBoard(previous => ({ ...previous, definitions: [...previous.definitions, { id: crypto.randomUUID(), label: 'New term', text: '' }] }));
    markDirty();
  };

  const removeDefinition = (id: string) => {
    setBoard(previous => ({ ...previous, definitions: previous.definitions.filter(entry => entry.id !== id) }));
    markDirty();
  };

  const doneCount = (card: StrategyCard) => card.items.filter(entry => entry.done).length;

  const renderCard = (card: StrategyCard, group: 'cards' | 'patterns') => {
    const Icon = ICONS[card.icon as keyof typeof ICONS] ?? Compass;
    return <article key={card.id} className={cn('strategy-card', 'is-editable', `tone-${card.tone}`)}>
      <header className="strategy-card-header">
        <span className="strategy-icon"><Icon size={16}/></span>
        <input className="inline-input strategy-title" aria-label={`${card.title} title`} value={card.title} onChange={event => updateCard(group, card.id, { title: event.target.value })}/>
        <div className="card-tools">
          <select className="mini-select" aria-label={`${card.title} icon`} value={card.icon} onChange={event => updateCard(group, card.id, { icon: event.target.value })}>
            {STRATEGY_ICONS.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
          <select className="mini-select" aria-label={`${card.title} colour`} value={card.tone} onChange={event => updateCard(group, card.id, { tone: event.target.value })}>
            {STRATEGY_TONES.map(tone => <option key={tone} value={tone}>{tone}</option>)}
          </select>
          <button type="button" className="icon-button tiny" aria-label={`Delete ${card.title}`} onClick={() => removeCard(group, card.id)}><Trash2 size={12}/></button>
        </div>
      </header>
      {card.intro !== '' || group === 'patterns' ? <input className="inline-input strategy-intro" aria-label={`${card.title} intro`} placeholder="Optional intro line" value={card.intro} onChange={event => updateCard(group, card.id, { intro: event.target.value })}/> : null}
      <ul className={card.kind === 'checklist' ? 'strategy-checklist editable' : 'strategy-list editable'}>
        {card.items.map(entry => <li key={entry.id} className={entry.done ? 'is-done' : undefined}>
          {card.kind === 'checklist' && <button type="button" className={cn('strategy-check', entry.done && 'checked')} aria-pressed={entry.done} aria-label={entry.done ? 'Mark as not done' : 'Mark as done'} onClick={() => updateItem(group, card.id, entry.id, { done: !entry.done })}>{entry.done && <Check size={9}/>}</button>}
          <textarea
            className="strategy-item-input"
            rows={1}
            value={entry.text}
            aria-label={`${card.title} item`}
            ref={element => { if (element) { element.style.height = '0px'; element.style.height = `${element.scrollHeight}px`; } }}
            onChange={event => updateItem(group, card.id, entry.id, { text: event.target.value })}
            onInput={event => { const element = event.currentTarget; element.style.height = '0px'; element.style.height = `${element.scrollHeight}px`; }}
          />
          <button type="button" className="item-remove" aria-label="Remove line" onClick={() => removeItem(group, card.id, entry.id)}><X size={11}/></button>
        </li>)}
      </ul>
      <div className="card-footer">
        <button type="button" className="button button-link" onClick={() => addItem(group, card.id)}><Plus size={11}/>Add line</button>
        {card.kind === 'checklist' && <span className="card-progress">{doneCount(card)}/{card.items.length} done</span>}
      </div>
    </article>;
  };

  return <div className={cn('strategy-editor', !editing && 'is-readonly')}>
    <div className="page-heading strategy-hero">
      <div>
        <h1>Trading Strategy</h1>
        <div className="heading-actions">
          <button type="button" className={editing ? 'button button-primary' : 'button'} onClick={() => { setEditing(!editing); if (editing) void save(); }}>
            {editing ? <><Check size={13}/>Done editing</> : <><Sparkles size={13}/>Edit this page</>}
          </button>
          <SaveIndicator status={status} error={error} hidden={!editing}/>
        </div>
      </div>
    </div>

    <div className="section-heading"><div><h2>Foundation</h2><p>The conditions that have to be true before an entry exists.</p></div></div>
    <div className="strategy-grid">{board.cards.map(card => renderCard(card, 'cards'))}</div>
    <div className="strategy-add-row"><button type="button" className="button" onClick={() => addCard('cards')}><Plus size={12}/>Add card</button></div>

    <div className="section-heading"><div><h2>The two algorithms</h2><p>Reversal and continuation share the entry model and differ in the environment they need.</p></div></div>
    <div className="strategy-patterns">{board.patterns.map(card => renderCard(card, 'patterns'))}</div>
    <div className="strategy-add-row"><button type="button" className="button" onClick={() => addCard('patterns')}><Plus size={12}/>Add algorithm</button></div>

    <div className="strategy-lower">
      <section className="panel">
        <div className="panel-heading"><div><h2 className="panel-title">Session windows</h2><p className="panel-subtitle">Winter and summer time differ by one hour.</p></div></div>
        <div className="panel-content">
          <div className="session-table">
            <div className="session-row session-head"><span>Session</span><span>Winter</span><span>Summer</span></div>
            {board.sessions.map(session => <div className="session-row editable" key={session.id}>
              <input className="inline-input" aria-label="Session label" value={session.label} onChange={event => updateSession(session.id, { label: event.target.value })}/>
              <input className="inline-input tabular" aria-label={`${session.label} winter`} value={session.winter} onChange={event => updateSession(session.id, { winter: event.target.value })}/>
              <input className="inline-input tabular" aria-label={`${session.label} summer`} value={session.summer} onChange={event => updateSession(session.id, { summer: event.target.value })}/>
            </div>)}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading"><div><h2 className="panel-title">Setup quality</h2><p className="panel-subtitle">How you rate a setup in the journal.</p></div></div>
        <div className="panel-content">
          <ol className="quality-ladder">{QUALITY_LADDER.map(step => <li key={step.tier}><QualityBadge value={step.tier}/><small>{step.hint}</small></li>)}</ol>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading"><div><h2 className="panel-title">Definitions</h2><p className="panel-subtitle">Excursion values and any other term you want to pin down.</p></div></div>
        <div className="panel-content strategy-definitions editable">
          {board.definitions.map(entry => <div key={entry.id} className="definition-row">
            <input className="inline-input definition-label" aria-label={`${entry.label} term`} value={entry.label} onChange={event => updateDefinition(entry.id, { label: event.target.value })}/>
            <textarea
              className="inline-input definition-text"
              aria-label={`${entry.label} definition`}
              rows={1}
              value={entry.text}
              ref={element => { if (element) { element.style.height = '0px'; element.style.height = `${element.scrollHeight}px`; } }}
              onChange={event => updateDefinition(entry.id, { text: event.target.value })}
              onInput={event => { const element = event.currentTarget; element.style.height = '0px'; element.style.height = `${element.scrollHeight}px`; }}
            />
            <button type="button" className="item-remove" aria-label={`Remove ${entry.label}`} onClick={() => removeDefinition(entry.id)}><X size={11}/></button>
          </div>)}
          <button type="button" className="button button-link" onClick={addDefinition}><Plus size={11}/>Add term</button>
        </div>
      </section>
    </div>
  </div>;
}

function SaveIndicator({ status, error, hidden }: { status: SaveState; error: string | null; hidden: boolean }) {
  if (hidden) return null;
  if (status === 'error') return <span className="save-state error"><AlertCircle size={12}/>{error || 'Not saved'}</span>;
  if (status === 'saving') return <span className="save-state saving"><Loader2 size={12} className="animate-spin"/>Saving…</span>;
  if (status === 'dirty') return <span className="save-state dirty">Unsaved changes</span>;
  if (status === 'saved') return <span className="save-state saved"><Check size={12}/>Saved</span>;
  return <span className="save-state">Every card is editable</span>;
}
