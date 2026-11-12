import { randomUUID } from 'node:crypto';
import { apiError, isUuid, noStoreJson, requireApiSession } from '@/lib/api-auth';
import { ensureSchema, getPool, getTrade } from '@/lib/db';
import { deleteUpload, detectImage, saveUpload, uploadLimitBytes } from '@/lib/uploads';
import { ensureTradePage, updatePage } from '@/lib/workspace';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Context = { params: Promise<{ id: string }> };

/**
 * Screenshots for an existing trade.
 *
 * The trade page is the owner of the image blocks, so a trade never has to know
 * whether its notes page exists yet: it is created on the first upload. This is
 * the endpoint behind both the chart cell and the paste panel in the trade
 * dialog, which is why it returns the new asset id rather than the whole page.
 */
export async function POST(request: Request, context: Context) {
  const denied = await requireApiSession();
  if (denied) return denied;
  const { id } = await context.params;
  if (!id || id.length > 64) return noStoreJson({ error: 'Trade not found.' }, 404);
  let storagePath: string | null = null;
  try {
    const trade = await getTrade(id);
    if (!trade) return noStoreJson({ error: 'Trade not found.' }, 404);
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return noStoreJson({ error: 'No image was uploaded.' }, 400);
    const buffer = Buffer.from(await file.arrayBuffer());
    if (!buffer.length) return noStoreJson({ error: 'The uploaded file is empty.' }, 400);
    if (buffer.length > uploadLimitBytes()) return noStoreJson({ error: 'Image is too large.' }, 413);
    const type = detectImage(buffer);
    if (!type) return noStoreJson({ error: 'Only PNG, JPEG, GIF or WebP images are supported.' }, 415);

    const page = await ensureTradePage({ id: trade.id, tradeId: trade.tradeId });
    const assetId = randomUUID();
    storagePath = await saveUpload(assetId, type.ext, buffer);
    await ensureSchema();
    const filename = (file.name || `screenshot.${type.ext}`).slice(0, 200);
    await getPool().query(
      'INSERT INTO assets (id,page_id,storage_path,filename,mime,size) VALUES ($1,$2,$3,$4,$5,$6)',
      [assetId, page.id, storagePath, filename, type.mime, buffer.length],
    );
    const caption = file.name && file.name !== 'image.png' ? filename : '';
    await updatePage(page.id, {
      content: {
        blocks: [
          ...page.content.blocks,
          { id: randomUUID(), type: 'image', text: '', assetId, caption },
        ],
      },
    });
    return noStoreJson({ asset: { id: assetId, caption, url: `/api/assets/${assetId}` } }, 201);
  } catch (error) {
    if (storagePath) await deleteUpload(storagePath);
    return apiError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  const denied = await requireApiSession();
  if (denied) return denied;
  const { id } = await context.params;
  if (!id || id.length > 64) return noStoreJson({ error: 'Trade not found.' }, 404);
  const assetId = new URL(request.url).searchParams.get('assetId');
  if (!isUuid(assetId)) return noStoreJson({ error: 'A valid asset is required.' }, 400);
  try {
    const trade = await getTrade(id);
    if (!trade) return noStoreJson({ error: 'Trade not found.' }, 404);
    const page = await ensureTradePage({ id: trade.id, tradeId: trade.tradeId });
    const removed = await getPool().query(
      'DELETE FROM assets WHERE id=$1 AND page_id=$2 RETURNING storage_path',
      [assetId, page.id],
    );
    if (!removed.rows[0]) return noStoreJson({ error: 'Asset not found on this trade.' }, 404);
    await deleteUpload(removed.rows[0].storage_path);
    await updatePage(page.id, {
      content: { blocks: page.content.blocks.filter(block => block.assetId !== assetId) },
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    return apiError(error, 503);
  }
}
