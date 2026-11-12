import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ensureSchema, getPool } from '../lib/db.ts';
import { detectImage, saveUpload } from '../lib/uploads.ts';
import { ensureTradePage, getPage, updatePage } from '../lib/workspace.ts';
import type { Block } from '../lib/workspace-types.ts';
import { importTradesFromCsv, parseCsv } from './import-notion.ts';

/**
 * Import a Notion "Markdown & CSV" export, including the chart screenshots.
 *
 *   npx tsx scripts/import-notion-export.ts <export.zip|export-folder> [--dry-run] [--replace|--merge] [--images-only]
 *
 * Pass the ZIP that Notion downloads, not an unzipped folder that only contains
 * the CSV: the image files live in one sub-folder per trade. The CSV's Analysis
 * column is used as the authoritative path when it is present; a numeric folder
 * name is the fallback.
 */

type Row = Record<string, string>;
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const MAX_REPORTED = 12;

type Candidate = {
  file: string;
  relative: string;
  name: string;
  tradeNumber: number | null;
};

function cell(row: Row, ...names: string[]): string {
  for (const name of names) {
    const value = row[name];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function normalisePath(value: string): string {
  let decoded = value;
  try { decoded = decodeURIComponent(value); } catch { /* Keep the raw value. */ }
  return decoded.replace(/\\/g, '/').replace(/^\/+/, '');
}

function basenameOf(value: string): string {
  const withoutQuery = value.split('?')[0].split('#')[0];
  return normalisePath(withoutQuery).split('/').pop() || '';
}

function tradeNumberFrom(value: string): number | null {
  const text = normalisePath(value);
  const segments = text.split('/');
  for (let index = segments.length - 2; index >= 0; index--) {
    const segment = segments[index].trim();
    const direct = /^(\d{1,6})$/.exec(segment);
    if (direct) return Number(direct[1]);
    const named = /(?:trade|journal)\s*#?\s*(\d{1,6})$/i.exec(segment);
    if (named) return Number(named[1]);
  }
  const file = basenameOf(text);
  const leading = /^(\d{1,6})\b/.exec(file);
  return leading ? Number(leading[1]) : null;
}

async function findCsv(root: string): Promise<string | null> {
  const found: string[] = [];
  const walk = async (directory: string) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.csv') found.push(full);
    }
  };
  await walk(root);
  for (const file of found.sort()) {
    const text = await readFile(file, 'utf8');
    const header = text.split(/\r?\n/, 1)[0] || '';
    if (/trade\s*id/i.test(header) || /net\s*€/i.test(header)) return file;
  }
  return found[0] ?? null;
}

async function collectImages(root: string): Promise<Candidate[]> {
  const found: Candidate[] = [];
  const walk = async (directory: string) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      if (!entry.isFile() || !IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
      const relative = path.relative(root, full);
      found.push({ file: full, relative, name: entry.name, tradeNumber: tradeNumberFrom(relative) });
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

async function unpack(source: string): Promise<{ root: string; temporary: boolean }> {
  const info = await stat(source);
  if (info.isDirectory()) return { root: source, temporary: false };
  if (path.extname(source).toLowerCase() !== '.zip') throw new Error('Pass the Notion export ZIP or its unzipped folder.');

  const temporary = await mkdtemp(path.join(tmpdir(), 'notion-export-'));
  let result = spawnSync('unzip', ['-q', '-o', source, '-d', temporary], { encoding: 'utf8' });
  if ((result.error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT') {
    result = spawnSync('ditto', ['-x', '-k', source, temporary], { encoding: 'utf8' });
  }
  if (result.status !== 0) {
    await rm(temporary, { recursive: true, force: true });
    throw new Error(`Could not unzip ${source}: ${(result.stderr || result.stdout || '').trim() || 'unzip failed'}`);
  }
  return { root: temporary, temporary: true };
}

async function main() {
  const source = process.argv[2];
  if (!source) throw new Error('Usage: import-notion-export.ts <export.zip|folder> [--dry-run] [--replace|--merge] [--images-only]');
  const dryRun = process.argv.includes('--dry-run');
  const replace = process.argv.includes('--replace');
  const imagesOnly = process.argv.includes('--images-only');
  const merge = process.argv.includes('--merge');
  if (replace) {
    console.warn('--replace deletes every trade first, including trades created in the app that are not in this export.');
  }
  if (merge && replace) throw new Error('Use either --replace or --merge, not both.');

  const { root, temporary } = await unpack(source);
  try {
    const csvPath = await findCsv(root);
    const images = await collectImages(root);
    const rows: Row[] = csvPath ? parseCsv(await readFile(csvPath, 'utf8')) : [];

    if (csvPath && !imagesOnly) {
      console.log(`Trades CSV: ${path.relative(root, csvPath)}`);
      if (dryRun) console.log('Dry run: trade rows are not written.');
      // Same process on purpose: a child `node --experimental-strip-types`
      // cannot resolve the application's extensionless imports.
      await importTradesFromCsv(csvPath, { dryRun, replace, merge });
    }

    await ensureSchema();
    const pool = getPool();
    const tradeRows = await pool.query<{ id: string; trade_id: string; trade_number: number | null }>(
      'SELECT id, trade_id, trade_number FROM trades',
    );
    const byId = new Map(tradeRows.rows.map(row => [row.trade_id, row]));
    const byNumber = new Map<number, typeof tradeRows.rows[number]>();
    for (const row of tradeRows.rows) {
      if (row.trade_number !== null) byNumber.set(Number(row.trade_number), row);
    }

    // The CSV is the best source for the screenshot order. The Analysis cell
    // may hold one path or several, comma-separated ("image.png, image 1.png"),
    // and Notion lists them in the order they appear on the page.
    type Target = { trade: typeof tradeRows.rows[number]; parts: string[]; number: number | null; downloadUrl: string | null };
    const targets: Target[] = [];
    for (const row of rows) {
      const tradeId = cell(row, 'Trade ID', 'Trade Number');
      const analysis = cell(row, 'Analysis', 'Screenshot', 'Screenshots', 'Chart', 'Image');
      const numeric = Number(tradeId);
      const trade = byId.get(tradeId) ?? (Number.isSafeInteger(numeric) ? byNumber.get(numeric) : undefined);
      if (!trade) continue;
      const parts = analysis.split(',').map(part => part.trim()).filter(Boolean);
      targets.push({
        trade,
        parts,
        number: trade.trade_number === null ? null : Number(trade.trade_number),
        downloadUrl: parts.find(part => /^https?:\/\//i.test(part)) ?? null,
      });
    }

    if (!targets.length) {
      for (const candidate of images) {
        if (candidate.tradeNumber === null) continue;
        const trade = byNumber.get(candidate.tradeNumber);
        if (trade) targets.push({ trade, parts: [], number: candidate.tradeNumber, downloadUrl: null });
      }
    }

    const used = new Set<Candidate>();
    const assignments = new Map<string, Candidate[]>();
    const add = (tradeId: string, candidate: Candidate) => {
      if (used.has(candidate)) return;
      used.add(candidate);
      const list = assignments.get(tradeId) ?? [];
      list.push(candidate);
      assignments.set(tradeId, list);
    };

    for (const target of targets) {
      for (const part of target.parts) {
        if (/^https?:\/\//i.test(part)) continue;
        const analysis = normalisePath(part).replace(/^.*?(?=Professional Master Trading Journal\/)/, '');
        const analysisName = basenameOf(part);
        const exact = images.filter(candidate => normalisePath(candidate.relative).endsWith(analysis));
        const sameName = images.filter(candidate => candidate.name === analysisName);
        const byName = target.number === null ? sameName : sameName.filter(candidate => candidate.tradeNumber === target.number);
        const chosen = exact.length ? exact : byName.length ? byName : sameName.length === 1 ? sameName : [];
        for (const candidate of chosen) add(target.trade.id, candidate);
      }
    }

    // Every image in a row's own numeric folder belongs to that trade: Notion
    // writes the property screenshot under its original name and any inline
    // page images as "image.png" / "image 1.png". Attach the rest as well, so a
    // recap with three charts keeps all three. The Analysis match stays first.
    for (const target of targets) {
      if (target.number === null) continue;
      for (const candidate of images.filter(item => item.tradeNumber === target.number)) add(target.trade.id, candidate);
    }

    const unmatched = images.filter(candidate => !used.has(candidate));
    const missingTrades: string[] = [];
    let attached = 0;
    let downloaded = 0;

    for (const target of targets) {
      const files = assignments.get(target.trade.id) ?? [];
      if (!files.length && target.downloadUrl) {
        if (dryRun) { downloaded++; continue; }
        try {
          const response = await fetch(target.downloadUrl, { redirect: 'follow', signal: AbortSignal.timeout(15000) });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const buffer = Buffer.from(await response.arrayBuffer());
          const type = detectImage(buffer);
          if (!type) throw new Error('The response is not a PNG, JPEG, GIF or WebP image');
          const name = basenameOf(target.downloadUrl) || `notion-${target.trade.trade_number ?? target.trade.trade_id}.${type.ext}`;
          files.push({ file: '', relative: name, name, tradeNumber: target.number });
          // Save the download through the same path as a local file.
          const page = await ensureTradePage({ id: target.trade.id, tradeId: target.trade.trade_id });
          const current = blocksOf((await getPage(page.id))?.content);
          const existing = replace ? current.filter(block => block.type !== 'image') : current;
          const seen = new Set(existing.filter(block => block.type === 'image').map(block => block.caption || ''));
          if (seen.has(name)) continue;
          const id = randomUUID();
          const storagePath = await saveUpload(id, type.ext, buffer);
          await pool.query(
            'INSERT INTO assets (id,page_id,storage_path,filename,mime,size) VALUES ($1,$2,$3,$4,$5,$6)',
            [id, page.id, storagePath, name.slice(0, 200), type.mime, buffer.length],
          );
          await updatePage(page.id, { content: { blocks: [...existing, { id: randomUUID(), type: 'image', text: '', assetId: id, caption: name }] } });
          attached++;
          downloaded++;
        } catch (error) {
          missingTrades.push(`Trade ${target.trade.trade_id}: ${error instanceof Error ? error.message : 'download failed'}`);
        }
        continue;
      }
      if (!files.length) { missingTrades.push(`Trade ${target.trade.trade_id}`); continue; }
      if (dryRun) { attached += files.length; continue; }

      const page = await ensureTradePage({ id: target.trade.id, tradeId: target.trade.trade_id });
      const current = blocksOf((await getPage(page.id))?.content);
      const existing = replace ? current.filter(block => block.type !== 'image') : current;
      const seen = new Set(existing.filter(block => block.type === 'image').map(block => block.caption || ''));
      const appended: Block[] = [];
      for (const candidate of files.sort((a, b) => a.name.localeCompare(b.name))) {
        if (seen.has(candidate.name)) continue;
        const buffer = await readFile(candidate.file);
        const type = detectImage(buffer);
        if (!type) { console.warn(`Skipped (not an image): ${candidate.relative}`); continue; }
        const id = randomUUID();
        const storagePath = await saveUpload(id, type.ext, buffer);
        await pool.query(
          'INSERT INTO assets (id,page_id,storage_path,filename,mime,size) VALUES ($1,$2,$3,$4,$5,$6)',
          [id, page.id, storagePath, candidate.name.slice(0, 200), type.mime, buffer.length],
        );
        appended.push({ id: randomUUID(), type: 'image', text: '', assetId: id, caption: candidate.name });
        attached++;
      }
      if (appended.length) await updatePage(page.id, { content: { blocks: [...existing, ...appended] } });
    }

    if (!dryRun) {
      // The screenshot path is no longer a dangling reference once the file is
      // attached, so drop the placeholder note the CSV import left behind.
      await pool.query(
        `UPDATE trades SET analysis_note = NULL
         WHERE analysis_note LIKE 'Notion screenshot%'
           AND id IN (SELECT pages.trade_id FROM assets JOIN pages ON assets.page_id = pages.id)`,
      );
    }

    console.log(JSON.stringify({
      source,
      csv: csvPath ? path.relative(root, csvPath) : null,
      tradesInCsv: rows.length,
      imagesFound: images.length,
      matchedImages: used.size,
      downloadedFromNotion: downloaded,
      attached: dryRun ? `${attached} (dry run)` : attached,
      tradesWithoutImages: missingTrades.slice(0, MAX_REPORTED),
      tradesWithoutImagesCount: missingTrades.length,
      unmatchedImages: unmatched.slice(0, MAX_REPORTED).map(candidate => candidate.relative),
      unmatchedImagesCount: unmatched.length,
    }, null, 2));

    if (!images.length) {
      console.log('\nNo image files were found in this export.');
      console.log('In Notion: open the journal database → ⋯ → Export → Markdown & CSV → enable "Include content" → export and download the ZIP.');
      console.log('Then run this command on the ZIP itself. A CSV-only export cannot contain the screenshots.');
    }
    await pool.end();
  } finally {
    if (temporary) await rm(root, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
