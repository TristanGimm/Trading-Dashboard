import { randomUUID } from 'node:crypto';
import { apiError, isUuid, noStoreJson, requireApiSession } from '@/lib/api-auth';
import { ensureSchema, getPool } from '@/lib/db';
import { deleteUpload, detectImage, saveUpload, uploadLimitBytes } from '@/lib/uploads';
import { getPage } from '@/lib/workspace';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const denied = await requireApiSession();
  if (denied) return denied;
  let storagePath: string | null = null;
  try {
    const form = await request.formData();
    const pageId = form.get('pageId');
    const file = form.get('file');
    if (!isUuid(pageId)) return noStoreJson({ error: 'A valid page is required.' }, 400);
    if (!(file instanceof File)) return noStoreJson({ error: 'No image was uploaded.' }, 400);
    if (!(await getPage(pageId))) return noStoreJson({ error: 'Page not found.' }, 404);
    const buffer = Buffer.from(await file.arrayBuffer());
    if (!buffer.length) return noStoreJson({ error: 'The uploaded file is empty.' }, 400);
    if (buffer.length > uploadLimitBytes()) return noStoreJson({ error: 'Image is too large.' }, 413);
    const type = detectImage(buffer);
    if (!type) return noStoreJson({ error: 'Only PNG, JPEG, GIF or WebP images are supported.' }, 415);
    const id = randomUUID();
    storagePath = await saveUpload(id, type.ext, buffer);
    await ensureSchema();
    await getPool().query(
      'INSERT INTO assets (id,page_id,storage_path,filename,mime,size) VALUES ($1,$2,$3,$4,$5,$6)',
      [id, pageId, storagePath, (file.name || `screenshot.${type.ext}`).slice(0, 200), type.mime, buffer.length],
    );
    return noStoreJson({ asset: { id, mime: type.mime, size: buffer.length, url: `/api/assets/${id}` } }, 201);
  } catch (error) {
    if (storagePath) await deleteUpload(storagePath);
    return apiError(error);
  }
}
