import { apiError, noStoreJson, requireApiSession } from '@/lib/api-auth';
import { createPage, listPageSummaries } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

export async function GET() {
  const denied = await requireApiSession();
  if (denied) return denied;
  try {
    return noStoreJson({ pages: await listPageSummaries() });
  } catch (error) {
    return apiError(error, 503);
  }
}

export async function POST(request: Request) {
  const denied = await requireApiSession();
  if (denied) return denied;
  try {
    const body = await request.json() as Record<string, unknown>;
    const page = await createPage({
      parentId: typeof body.parentId === 'string' ? body.parentId : null,
      title: typeof body.title === 'string' ? body.title : undefined,
      icon: typeof body.icon === 'string' ? body.icon : undefined,
      content: body.content,
    });
    return noStoreJson({ page }, 201);
  } catch (error) {
    return apiError(error);
  }
}
