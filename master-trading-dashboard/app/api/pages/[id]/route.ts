import { apiError, isUuid, noStoreJson, requireApiSession } from '@/lib/api-auth';
import { deleteUpload } from '@/lib/uploads';
import { deletePage, getPage, updatePage } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: Context) {
  const denied = await requireApiSession();
  if (denied) return denied;
  const { id } = await context.params;
  if (!isUuid(id)) return noStoreJson({ error: 'Page not found.' }, 404);
  try {
    const page = await getPage(id);
    return page ? noStoreJson({ page }) : noStoreJson({ error: 'Page not found.' }, 404);
  } catch (error) {
    return apiError(error, 503);
  }
}

export async function PATCH(request: Request, context: Context) {
  const denied = await requireApiSession();
  if (denied) return denied;
  const { id } = await context.params;
  if (!isUuid(id)) return noStoreJson({ error: 'Page not found.' }, 404);
  try {
    const body = await request.json() as Record<string, unknown>;
    const page = await updatePage(id, {
      title: typeof body.title === 'string' ? body.title : undefined,
      icon: typeof body.icon === 'string' ? body.icon : undefined,
      content: body.content,
      parentId: body.parentId === null ? null : typeof body.parentId === 'string' ? body.parentId : undefined,
      position: typeof body.position === 'number' ? body.position : undefined,
      archived: typeof body.archived === 'boolean' ? body.archived : undefined,
    });
    return page ? noStoreJson({ page }) : noStoreJson({ error: 'Page not found.' }, 404);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_: Request, context: Context) {
  const denied = await requireApiSession();
  if (denied) return denied;
  const { id } = await context.params;
  if (!isUuid(id)) return noStoreJson({ error: 'Page not found.' }, 404);
  try {
    const paths = await deletePage(id);
    await Promise.all(paths.map(path => deleteUpload(path)));
    return new Response(null, { status: 204 });
  } catch (error) {
    return apiError(error, 503);
  }
}
