import { randomUUID } from 'node:crypto';
import { readdir, stat } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ensureSchema, getPool } from '../lib/db';
import { detectImage, saveUpload } from '../lib/uploads';
import { ensureTradePage, updatePage } from '../lib/workspace';
import type { Block } from '../lib/workspace-types';

/**
 * Attach Notion chart screenshots to the matching trades.
 *
 *   npx tsx scripts/import-notion-images.ts <folder> [--dry-run] [--replace]
 *
 * The folder may be the unzipped "Master Trading Journal" export, in which case
 * every sub-folder named after a trade number is read. A flat folder works too:
 * files are then matched on any run of digits in their path.
 */

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

type Candidate = { file: string; tradeNumber: number; name: string };

async function collect(root: string): Promise<Candidate[]> {
  const found: Candidate[] = [];
  const walk = async (directory: string) => {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        // A folder named after the trade number scopes every file inside it.
        const numeric = /^(\d{1,6})$/.exec(entry.name);
        if (numeric) {
          const tradeNumber = Number(numeric[1]);
          const files = await readdir(full, { withFileTypes: true });
          for (const file of files) {
            if (!file.isFile()) continue;
            if (!IMAGE_EXTENSIONS.has(path.extname(file.name).toLowerCase())) continue;
            found.push({ file: path.join(full, file.name), tradeNumber, name: file.name });
          }
          continue;
        }
        await walk(full);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
      // cT_cs_2069299_XAUUSD_... has no trade number; fall back to a leading number.
      const leading = /^(\d{1,6})\b/.exec(entry.name);
      if (leading) found.push({ file: full, tradeNumber: Number(leading[1]), name: entry.name });
    }
  };
  await walk(root);
  return found;
}

function blocksOf(value: unknown): Block[] {
  if (!value || typeof value !== 'object') return [];
  const blocks = (value as { blocks?: unknown }).blocks;
  return Array.isArray(blocks) ? blocks as Block[] : [];
}

async function main() {
  const root = process.argv[2];
  if (!root) throw new Error('Usage: import-notion-images.ts <folder> [--dry-run] [--replace]');
  const dryRun = process.argv.includes('--dry-run');
  const replace = process.argv.includes('--replace');

  const info = await stat(root).catch(() => null);
  if (!info?.isDirectory()) throw new Error(`Not a folder: ${root}`);

  const candidates = await collect(root);
  if (!candidates.length) {
    console.log('No images found. A Notion export only contains images when it is exported as Markdown & CSV with "Include content" enabled.');
    return;
  }

  await ensureSchema();
  const pool = getPool();
  const rows = await pool.query<{ trade_number: number | null; id: string; trade_id: string }>('SELECT trade_number, id, trade_id FROM trades');
  const byNumber = new Map<number, { id: string; tradeId: string }>();
  for (const row of rows.rows) {
    if (row.trade_number !== null) byNumber.set(Number(row.trade_number), { id: row.id, tradeId: row.trade_id });
  }

  const grouped = new Map<number, Candidate[]>();
  for (const candidate of candidates) {
    const list = grouped.get(candidate.tradeNumber) ?? [];
    list.push(candidate);
    grouped.set(candidate.tradeNumber, list);
  }

  const missing: number[] = [];
  let attached = 0;
  for (const [tradeNumber, files] of [...grouped].sort((a, b) => a[0] - b[0])) {
    const trade = byNumber.get(tradeNumber);
    if (!trade) { missing.push(tradeNumber); continue; }
    if (dryRun) { attached += files.length; continue; }

    const page = await ensureTradePage({ id: trade.id, tradeId: trade.tradeId });
    const current = blocksOf(page.content);
    const existing = replace ? [] : current;
    const seen = new Set(existing.filter(block => block.type === 'image').map(block => block.caption || ''));
    const appended: Block[] = [];
    for (const file of files.sort((a, b) => a.name.localeCompare(b.name))) {
      if (seen.has(file.name)) continue;
      const buffer = await readFile(file.file);
      const type = detectImage(buffer);
      if (!type) { console.warn(`Skipped (not an image): ${file.file}`); continue; }
      const id = randomUUID();
      const storagePath = await saveUpload(id, type.ext, buffer);
      await pool.query(
        'INSERT INTO assets (id,page_id,storage_path,filename,mime,size) VALUES ($1,$2,$3,$4,$5,$6)',
        [id, page.id, storagePath, file.name.slice(0, 200), type.mime, buffer.length],
      );
      appended.push({ id: randomUUID(), type: 'image', text: '', assetId: id, caption: file.name });
      attached++;
    }
    if (appended.length) {
      await updatePage(page.id, { content: { blocks: [...existing, ...appended] } });
    }
  }

  console.log(JSON.stringify({
    images: candidates.length,
    tradesMatched: grouped.size - missing.length,
    attached: dryRun ? `${attached} (dry run)` : attached,
    tradesWithoutMatch: missing.sort((a, b) => a - b),
  }, null, 2));
  await pool.end();
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
