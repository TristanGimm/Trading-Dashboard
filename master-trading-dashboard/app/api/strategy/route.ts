import { apiError, noStoreJson, requireApiSession } from '@/lib/api-auth';
import { getStrategyBoard, saveStrategyBoard } from '@/lib/strategy';

export const dynamic = 'force-dynamic';

export async function GET() {
  const denied = await requireApiSession();
  if (denied) return denied;
  try {
    return noStoreJson({ board: await getStrategyBoard() });
  } catch (error) {
    return apiError(error, 503);
  }
}

export async function PUT(request: Request) {
  const denied = await requireApiSession();
  if (denied) return denied;
  try {
    const body = await request.json();
    return noStoreJson({ board: await saveStrategyBoard(body) });
  } catch (error) {
    return apiError(error);
  }
}
