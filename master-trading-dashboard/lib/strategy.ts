import { randomUUID } from 'node:crypto';
import { ensureSchema, getPool } from './db';
import { STRATEGY_ICONS, STRATEGY_TONES, type StrategyBoard, type StrategyCard, type StrategyDefinition, type StrategyItem, type StrategySession } from './strategy-types';

export type { StrategyBoard, StrategyCard, StrategyDefinition, StrategyItem, StrategySession } from './strategy-types';
export { STRATEGY_ICONS, STRATEGY_TONES } from './strategy-types';

const MAX_CARDS = 24;
const MAX_ITEMS = 60;
const MAX_TEXT = 4000;
const MAX_TITLE = 120;

function item(text: string, done = false): StrategyItem {
  return { id: randomUUID(), text, done };
}

function card(input: Omit<StrategyCard, 'id' | 'items'> & { items: (StrategyItem | string)[] }): StrategyCard {
  return {
    id: randomUUID(),
    ...input,
    items: input.items.map(entry => typeof entry === 'string' ? item(entry) : entry),
  };
}

export function defaultStrategyBoard(): StrategyBoard {
  return {
    headline: 'The rules, written down.',
    subline: 'Your playbook: process, timing, entry models and the two algorithms. This is the reference behind every journal entry.',
    cards: [
      card({
        title: 'Process', icon: 'compass', tone: 'indigo', kind: 'list', intro: '',
        items: [
          'What: Condition, Type, Duration (ltf, mtf, htf), Legs, previous setup. It has to be OBVIOUS.',
          'Where: entry relativity and direction.',
          'How: overextension — type and duration.',
          'When: entry model → shift + fractal shift. The bigger the overextension, the bigger the shift has to be.',
        ],
      }),
      card({
        title: 'Time', icon: 'clock', tone: 'green', kind: 'list', intro: '',
        items: [
          'London 06:00 – 12:00. Every day.',
          'Do not trade 12:00 – 14:00. No volume.',
          'New York open & London medium 14:00 – 18:00.',
          'Do not trade after 18:00 — it becomes random and fakeouts occur more often.',
          'Second Asia 01:00 – 04:00, second London 09:00 – 11:00.',
        ],
      }),
      card({
        title: 'Psychology', icon: 'sparkles', tone: 'purple', kind: 'list', intro: '',
        items: [
          'Focus on learning and consistency with the system, not on making profits.',
          'Decision fatigue is real. Do not trade when you are fatigued.',
          'A strategy only makes sense in the right market condition — adapt to the market.',
        ],
      }),
      card({
        title: 'Entry Models', icon: 'crosshair', tone: 'pink', kind: 'list', intro: '',
        items: ['Type 3 shift.', 'If it is hard to find an entry, do not trade.', 'Day-trading means not trading daily.'],
      }),
      card({
        title: 'Stop Loss', icon: 'shield', tone: 'red', kind: 'list', intro: '',
        items: ['Stop loss behind the external high / low.', 'Focus on market condition, not the take profit.'],
      }),
      card({
        title: 'Take Profit', icon: 'target', tone: 'green', kind: 'list', intro: '',
        items: [
          'Let wins run if the market condition is perfect.',
          'Only after moving the stop to 1:1.',
          'Aim for 1:3. Everything above only when you are up big and can afford to gamble.',
        ],
      }),
      card({
        title: 'Risk Management', icon: 'gauge', tone: 'amber', kind: 'checklist', intro: '',
        items: ['Focus on one setup per day.', 'Focus on a high win rate instead of a high R:R.', 'A good loss is when the market condition changes.'],
      }),
    ],
    patterns: [
      card({
        title: 'CBR · Candle Behaviour Reversal', icon: 'trending', tone: 'teal', kind: 'checklist',
        intro: 'Reversal algorithm, executed in four phases.',
        items: [
          'Phase 1 — Environment & time: check the FTMO economic calendar. Red USD news means no trade.',
          'Phase 1: is the overall market a range or a trending range? There has to be an obvious ranging pattern.',
          'Phase 2 — Bias: is the higher timeframe (1H/4H) aligning with the trade idea?',
          'Phase 2: is DXY showing an inverse correlation to gold right now?',
          'Phase 3 — Setup: 15m CBR · LTF → 1.5 h = 5m overextension → 5s shift at 7.5 min.',
          'Phase 3: 30m CBR · LMTF → 3 h = 10m overextension → 5s shift at 15 min.',
          'Phase 3: 1h CBR · MTF → 5–10 h = 20 min overextension → 1m shift + 5s fractal shift at 30 min.',
          'Phase 3: 4h CBR · HTF → 20+ h = 60 min overextension → 1m fractal shifts at 2 h.',
          'Phase 3: did an overextension occur and a shift follow? Does a fractal shift confirm entry at the 50 % pullback of the previous shift?',
          'Phase 4 — Execution: market order, stop beyond the recent low/high, take profit at 50 % of the equilibrium of the overextension.',
          'Phase 4: expect a loss. Always. Update the journal.',
          'The more higher timeframes, shifts and DXY align, the higher the trade quality.',
        ],
      }),
      card({
        title: 'CBC · Candle Behaviour Continuation', icon: 'list', tone: 'slate', kind: 'checklist',
        intro: 'Continuation algorithm, executed in four phases.',
        items: [
          'Phase 1 — Environment & time: news for gold — FED, DXY, interest rate, war.',
          'Phase 1: is the overall market condition trending? It has to be obvious.',
          'Phase 2 — Liquidity sweep: did price push through and sweep the marked 1H high/low, PDH/PDL or 4H extreme?',
          'Phase 2 — Clear displacement: did an aggressive, fast move follow the sweep without immediately retracing?',
          'Phase 2 — Reaction: did price pull back into that specific zone or order block?',
          'Phase 3 — Same entry model as the reversal pattern across 15m, 30m, 1h and 4h.',
          'Phase 4 — Execution: market order, stop beyond the recent low/high, take profit at the next liquidity zone.',
          'Phase 4: expect a loss. Always. Update the journal.',
        ],
      }),
    ],
    sessions: [
      { id: randomUUID(), label: 'Sydney', winter: '23:00 – 08:00', summer: '00:00 – 09:00' },
      { id: randomUUID(), label: 'Tokyo', winter: '01:00 – 10:00', summer: '02:00 – 11:00' },
      { id: randomUUID(), label: 'London', winter: '09:00 – 18:00', summer: '10:00 – 19:00' },
      { id: randomUUID(), label: 'New York', winter: '14:00 – 23:00', summer: '15:00 – 00:00' },
    ],
    definitions: [
      { id: randomUUID(), label: 'MAE', text: 'How far price moved against you while you were in the trade.' },
      { id: randomUUID(), label: 'MFE', text: 'How far price moved in your favour.' },
    ],
    updatedAt: null,
  };
}

function text(value: unknown, max: number, fallback = ''): string {
  return typeof value === 'string' ? value.slice(0, max) : fallback;
}

function id(value: unknown): string {
  return typeof value === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(value) ? value : randomUUID();
}

function sanitizeCard(input: unknown, index: number): StrategyCard {
  const source = (input ?? {}) as Partial<Omit<StrategyCard, 'items'>> & { items?: unknown[] };
  const icon = STRATEGY_ICONS.includes(source.icon as typeof STRATEGY_ICONS[number]) ? source.icon as string : 'compass';
  const tone = STRATEGY_TONES.includes(source.tone as typeof STRATEGY_TONES[number]) ? source.tone as string : 'slate';
  const items: unknown[] = Array.isArray(source.items) ? source.items.slice(0, MAX_ITEMS) : [];
  return {
    id: id(source.id),
    title: text(source.title, MAX_TITLE) || `Card ${index + 1}`,
    icon,
    tone,
    kind: source.kind === 'checklist' ? 'checklist' : 'list',
    intro: text(source.intro, 400),
    items: items.map((entry): StrategyItem => {
      if (typeof entry === 'string') return item(entry.slice(0, MAX_TEXT));
      const record = (entry ?? {}) as Partial<StrategyItem>;
      return { id: id(record.id), text: text(record.text, MAX_TEXT), done: record.done === true };
    }),
  };
}

export function sanitizeStrategyBoard(input: unknown): StrategyBoard {
  const source = (input ?? {}) as Partial<StrategyBoard>;
  const cards = Array.isArray(source.cards) ? source.cards.slice(0, MAX_CARDS) : [];
  const patterns = Array.isArray(source.patterns) ? source.patterns.slice(0, MAX_CARDS) : [];
  const sessions = Array.isArray(source.sessions) ? source.sessions.slice(0, 20) : [];
  const definitions = Array.isArray(source.definitions) ? source.definitions.slice(0, 20) : [];
  return {
    headline: text(source.headline, 160) || 'The rules, written down.',
    subline: text(source.subline, 600),
    cards: cards.map(sanitizeCard),
    patterns: patterns.map(sanitizeCard),
    sessions: sessions.map(entry => {
      const record = (entry ?? {}) as Partial<StrategySession>;
      return { id: id(record.id), label: text(record.label, 40), winter: text(record.winter, 40), summer: text(record.summer, 40) };
    }),
    definitions: definitions.map(entry => {
      const record = (entry ?? {}) as Partial<StrategyDefinition>;
      return { id: id(record.id), label: text(record.label, 40), text: text(record.text, 400) };
    }),
    updatedAt: null,
  };
}

type Row = { content: unknown; updated_at: Date };

export async function getStrategyBoard(): Promise<StrategyBoard> {
  await ensureSchema();
  const result = await getPool().query<Row>('SELECT content, updated_at FROM strategy_board WHERE id=1');
  const row = result.rows[0];
  if (!row) {
    const board = defaultStrategyBoard();
    await getPool().query('INSERT INTO strategy_board (id, content) VALUES (1,$1) ON CONFLICT (id) DO NOTHING', [JSON.stringify(board)]);
    return board;
  }
  const board = sanitizeStrategyBoard(row.content);
  return { ...board, updatedAt: row.updated_at.toISOString() };
}

export async function saveStrategyBoard(input: unknown): Promise<StrategyBoard> {
  await ensureSchema();
  const board = sanitizeStrategyBoard(input);
  const result = await getPool().query<Row>(
    `INSERT INTO strategy_board (id, content, updated_at) VALUES (1,$1,NOW())
     ON CONFLICT (id) DO UPDATE SET content=EXCLUDED.content, updated_at=NOW()
     RETURNING content, updated_at`,
    [JSON.stringify(board)],
  );
  const row = result.rows[0];
  return { ...sanitizeStrategyBoard(row.content), updatedAt: row.updated_at.toISOString() };
}
