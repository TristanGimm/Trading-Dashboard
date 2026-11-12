import { apiError, noStoreJson, requireApiSession } from '@/lib/api-auth';
import { getTrade } from '@/lib/db';
import { deleteTrade, updateTrade } from '@/lib/trades';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: Context) {
  const denied = await requireApiSession();
  if (denied) return denied;
  const { id } = await context.params;
  try {
    const trade = await getTrade(id);
    return trade ? noStoreJson({ trade }) : noStoreJson({ error: 'Trade not found.' }, 404);
  } catch (error) {
    return apiError(error, 503);
  }
}

export async function PATCH(request: Request, context: Context) {
  const denied = await requireApiSession();
  if (denied) return denied;
  const { id } = await context.params;
  if (!id || id.length > 64) return noStoreJson({ error: 'Trade not found.' }, 404);
  try {
    const body = await request.json();
    const trade = await updateTrade(id, body);
    return trade ? noStoreJson({ trade }) : noStoreJson({ error: 'Trade not found.' }, 404);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_: Request, context: Context) {
  const denied = await requireApiSession();
  if (denied) return denied;
  const { id } = await context.params;
  if (!id || id.length > 64) return noStoreJson({ error: 'Trade not found.' }, 404);
  try {
    const removed = await deleteTrade(id);
    return removed ? new Response(null, { status: 204 }) : noStoreJson({ error: 'Trade not found.' }, 404);
  } catch (error) {
    return apiError(error, 503);
  }
}
