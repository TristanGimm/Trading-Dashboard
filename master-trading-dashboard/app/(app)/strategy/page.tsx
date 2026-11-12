import { requireSession } from '@/lib/auth';
import { getStrategyBoard } from '@/lib/strategy';
import { StrategyEditor } from '@/components/strategy/strategy-editor';

export const dynamic = 'force-dynamic';

export default async function StrategyPage() {
  await requireSession('/strategy');
  const board = await getStrategyBoard();
  return <StrategyEditor initial={board}/>;
}
