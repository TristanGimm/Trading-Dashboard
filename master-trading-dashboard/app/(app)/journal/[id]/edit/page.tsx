import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requireSession } from '@/lib/auth';
import { getDashboardTimezone } from '@/lib/timezone';
import { getTrade } from '@/lib/db';
import { TradeForm } from '@/components/journal/trade-form';

export const dynamic = 'force-dynamic';

export default async function EditTradePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireSession(`/journal/${id}/edit`);
  const trade = await getTrade(id);
  if (!trade) notFound();
  const timeZone = getDashboardTimezone(process.env.DASHBOARD_TIMEZONE);
  return <>
    <div className="page-heading">
      <div><div className="eyebrow">JOURNAL / EDIT TRADE</div><h1>Edit trade #{trade.tradeId}.</h1><p>Update the recorded properties. Notes and screenshots live on the trade page.</p></div>
      <div className="heading-actions"><Link className="button" href={`/journal/${trade.id}`}><ArrowLeft size={13}/>Back to trade</Link></div>
    </div>
    <section className="panel trade-form-panel"><div className="panel-content"><TradeForm trade={trade} timeZone={timeZone} now={new Date().toISOString()}/></div></section>
  </>;
}
