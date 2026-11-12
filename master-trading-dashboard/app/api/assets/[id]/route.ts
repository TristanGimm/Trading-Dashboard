import { apiError, isUuid, noStoreJson, requireApiSession } from '@/lib/api-auth';
import { ensureSchema, getPool } from '@/lib/db';
import { deleteUpload, readUpload } from '@/lib/uploads';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: Context) {
  const denied = await requireApiSession();
  if (denied) return denied;
  const { id } = await context.params;
  if (!isUuid(id)) return noStoreJson({ error: 'Asset not found.' }, 404);
  try {
    await ensureSchema();
    const result = await getPool().query('SELECT storage_path,mime,size FROM assets WHERE id=$1', [id]);
    const asset = result.rows[0];
    if (!asset) return noStoreJson({ error: 'Asset not found.' }, 404);
    const data = await readUpload(asset.storage_path);
    return new Response(new Uint8Array(data), {
      headers: {
        'Content-Type': asset.mime,
        'Content-Length': String(data.length),
        'Cache-Control': 'private, max-age=31536000, immutable',
        'Content-Disposition': 'inline',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return noStoreJson({ error: 'Asset file is missing.' }, 404);
    return apiError(error, 503);
  }
}

export async function DELETE(_: Request, context: Context) {
  const denied = await requireApiSession();
  if (denied) return denied;
  const { id } = await context.params;
  if (!isUuid(id)) return noStoreJson({ error: 'Asset not found.' }, 404);
  try {
    await ensureSchema();
    const result = await getPool().query('DELETE FROM assets WHERE id=$1 RETURNING storage_path', [id]);
    if (result.rows[0]) await deleteUpload(result.rows[0].storage_path);
    return new Response(null, { status: 204 });
  } catch (error) {
    return apiError(error, 503);
  }
}
