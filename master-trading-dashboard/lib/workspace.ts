import { randomUUID } from 'node:crypto';
import { ensureSchema, getPool } from './db';
import type { PageContent, WorkspacePage, WorkspacePageKind, WorkspacePageSummary } from './workspace-types';
import { emptyPageContent } from './workspace-types';

type PageRow = {
  id: string;
  parent_id: string | null;
  title: string;
  icon: string;
  kind: WorkspacePageKind;
  trade_id: string | null;
  content: unknown;
  position: number;
  archived: boolean;
  created_at: Date;
  updated_at: Date;
};

type PageAssetRow = { storage_path: string };

const blockTypes = new Set([
  'paragraph', 'heading1', 'heading2', 'heading3', 'bulleted', 'numbered',
  'todo', 'quote', 'callout', 'code', 'divider', 'image',
]);
const MAX_BLOCKS = 500;
const MAX_TEXT = 20000;
const MAX_CAPTION = 500;

function mapPage(row: PageRow): WorkspacePage {
  return {
    id: row.id,
    parentId: row.parent_id,
    title: row.title,
    icon: row.icon,
    kind: row.kind,
    tradeId: row.trade_id,
    position: Number(row.position),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    content: sanitizePageContent(row.content, false),
  };
}

/**
 * Validate page content before writing. Image blocks only carry an asset id,
 * never HTML, so React always renders untrusted text as text.
 */
export function sanitizePageContent(value: unknown, strict = true): PageContent {
  if (!value || typeof value !== 'object' || !Array.isArray((value as PageContent).blocks)) {
    if (strict) throw new Error('Page content must contain a blocks array.');
    return { blocks: [] };
  }
  const input = (value as PageContent).blocks;
  if (input.length > MAX_BLOCKS) throw new Error(`A page can contain at most ${MAX_BLOCKS} blocks.`);
  const blocks: PageContent['blocks'] = [];
  const seen = new Set<string>();
  for (const candidate of input) {
    if (!candidate || typeof candidate !== 'object') {
      if (strict) throw new Error('Invalid page block.');
      continue;
    }
    const type = candidate.type;
    if (!blockTypes.has(type)) {
      if (strict) throw new Error('Unknown page block type.');
      continue;
    }
    const text = typeof candidate.text === 'string' ? candidate.text.slice(0, MAX_TEXT) : '';
    let id = typeof candidate.id === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(candidate.id) ? candidate.id : randomUUID();
    if (seen.has(id)) id = randomUUID();
    seen.add(id);
    const block: PageContent['blocks'][number] = { id, type, text } as PageContent['blocks'][number];
    if (type === 'todo') block.checked = candidate.checked === true;
    if (type === 'image') {
      if (typeof candidate.assetId === 'string' && /^[a-f0-9-]{36}$/i.test(candidate.assetId)) block.assetId = candidate.assetId;
      else if (strict) throw new Error('Image blocks need a valid asset id.');
      block.caption = typeof candidate.caption === 'string' ? candidate.caption.slice(0, MAX_CAPTION) : '';
    }
    blocks.push(block);
  }
  return { blocks };
}

export async function listPageSummaries(kind?: WorkspacePageKind): Promise<WorkspacePageSummary[]> {
  await ensureSchema();
  const result = await getPool().query(
    `SELECT id,parent_id,title,icon,kind,trade_id,position,created_at,updated_at
     FROM pages WHERE archived=FALSE ${kind ? 'AND kind=$1' : ''}
     ORDER BY position ASC, updated_at DESC`,
    kind ? [kind] : [],
  );
  return result.rows.map((row: Omit<PageRow, 'content' | 'archived'>) => ({
    id: row.id,
    parentId: row.parent_id,
    title: row.title,
    icon: row.icon,
    kind: row.kind,
    tradeId: row.trade_id,
    position: Number(row.position),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }));
}

export async function listRecentPages(limit = 6): Promise<WorkspacePageSummary[]> {
  const pages = await listPageSummaries();
  return [...pages]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, Math.max(1, Math.min(limit, 30)));
}

export async function getPage(id: string): Promise<WorkspacePage | null> {
  await ensureSchema();
  const result = await getPool().query('SELECT * FROM pages WHERE id=$1 AND archived=FALSE', [id]);
  return result.rows[0] ? mapPage(result.rows[0]) : null;
}

export async function createPage(input: {
  parentId?: string | null;
  title?: string;
  icon?: string;
  kind?: WorkspacePageKind;
  tradeId?: string | null;
  content?: unknown;
}): Promise<WorkspacePage> {
  await ensureSchema();
  const kind = input.kind === 'trade' ? 'trade' : 'page';
  if (kind === 'trade' && !input.tradeId) throw new Error('Trade pages need a trade.');
  const parentId = input.parentId || null;
  if (parentId) {
    const parent = await getPool().query('SELECT id,kind FROM pages WHERE id=$1 AND archived=FALSE', [parentId]);
    if (!parent.rows[0] || parent.rows[0].kind !== 'page') throw new Error('Parent page not found.');
  }
  const title = (input.title || 'Untitled').trim().slice(0, 200) || 'Untitled';
  const icon = (input.icon || (kind === 'trade' ? '📈' : '📄')).trim().slice(0, 16) || '📄';
  const content = input.content === undefined ? emptyPageContent : sanitizePageContent(input.content);
  const id = randomUUID();
  const positionRow = await getPool().query('SELECT COALESCE(MAX(position),0)+1 AS next FROM pages WHERE parent_id IS NOT DISTINCT FROM $1', [parentId]);
  const position = Number(positionRow.rows[0]?.next || 1);
  const result = await getPool().query(
    `INSERT INTO pages (id,parent_id,title,icon,kind,trade_id,content,position)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [id, parentId, title, icon, kind, input.tradeId || null, JSON.stringify(content), position],
  );
  return mapPage(result.rows[0]);
}

export async function ensureTradePage(trade: { id: string; tradeId: string }): Promise<WorkspacePage> {
  await ensureSchema();
  const existing = await getPool().query('SELECT * FROM pages WHERE trade_id=$1', [trade.id]);
  if (existing.rows[0]) return mapPage(existing.rows[0]);
  const page = await createPage({
    title: `Trade #${trade.tradeId} notes`,
    icon: '📈',
    kind: 'trade',
    tradeId: trade.id,
    content: emptyPageContent,
  });
  return page;
}

async function isDescendant(candidateParentId: string, id: string): Promise<boolean> {
  let current: string | null = candidateParentId;
  const seen = new Set<string>();
  while (current) {
    if (current === id) return true;
    if (seen.has(current)) return false;
    seen.add(current);
    const parent: { rows: { parent_id: string | null }[] } = await getPool().query('SELECT parent_id FROM pages WHERE id=$1', [current]);
    current = parent.rows[0]?.parent_id ?? null;
  }
  return false;
}

export async function updatePage(id: string, patch: {
  title?: string;
  icon?: string;
  content?: unknown;
  parentId?: string | null;
  position?: number;
  archived?: boolean;
}): Promise<WorkspacePage | null> {
  await ensureSchema();
  const current = await getPage(id);
  if (!current) return null;
  let parentId = current.parentId;
  if (patch.parentId !== undefined) {
    parentId = patch.parentId || null;
    if (current.kind === 'trade' && parentId) throw new Error('Trade notes cannot be moved into a page.');
    if (parentId === id) throw new Error('A page cannot be its own parent.');
    if (parentId) {
      const parent = await getPool().query('SELECT id,kind FROM pages WHERE id=$1 AND archived=FALSE', [parentId]);
      if (!parent.rows[0] || parent.rows[0].kind !== 'page') throw new Error('Parent page not found.');
      if (await isDescendant(parentId, id)) throw new Error('A page cannot be moved below one of its children.');
    }
  }
  const title = patch.title === undefined ? current.title : (patch.title.trim().slice(0, 200) || 'Untitled');
  const icon = patch.icon === undefined ? current.icon : (patch.icon.trim().slice(0, 16) || '📄');
  const content = patch.content === undefined ? current.content : sanitizePageContent(patch.content);
  const position = patch.position === undefined || !Number.isFinite(patch.position) ? current.position : patch.position;
  const archived = patch.archived === undefined ? false : patch.archived === true;
  const result = await getPool().query(
    `UPDATE pages SET title=$2,icon=$3,content=$4,parent_id=$5,position=$6,archived=$7,updated_at=NOW()
     WHERE id=$1 RETURNING *`,
    [id, title, icon, JSON.stringify(content), parentId, position, archived],
  );
  return result.rows[0] ? mapPage(result.rows[0]) : null;
}

/** Delete a page and its descendants; returns uploaded files that can now be removed. */
export async function deletePage(id: string): Promise<string[]> {
  await ensureSchema();
  const assets = await getPool().query(
    `WITH RECURSIVE tree AS (
       SELECT id FROM pages WHERE id=$1
       UNION
       SELECT pages.id FROM pages JOIN tree ON pages.parent_id=tree.id
     )
     SELECT storage_path FROM assets WHERE page_id IN (SELECT id FROM tree)`,
    [id],
  );
  await getPool().query('DELETE FROM pages WHERE id=$1', [id]);
  return assets.rows.map((row: PageAssetRow) => row.storage_path);
}

export type WorkspaceStats = {
  pages: number;
  trades: number;
  screenshots: number;
  lastUpdated: string | null;
};

export async function workspaceStats(): Promise<WorkspaceStats> {
  await ensureSchema();
  const result = await getPool().query(
    `SELECT
       (SELECT COUNT(*)::int FROM pages WHERE kind='page' AND archived=FALSE) AS pages,
       (SELECT COUNT(*)::int FROM trades) AS trades,
       (SELECT COUNT(*)::int FROM assets) AS screenshots,
       (SELECT MAX(at) FROM (SELECT MAX(updated_at) AS at FROM trades UNION ALL SELECT MAX(updated_at) FROM pages) times) AS last_updated`,
  );
  const row = result.rows[0];
  return {
    pages: Number(row.pages),
    trades: Number(row.trades),
    screenshots: Number(row.screenshots),
    lastUpdated: row.last_updated?.toISOString() ?? null,
  };
}
