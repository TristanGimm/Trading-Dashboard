import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireSession } from '@/lib/auth';
import { getDashboardTimezone } from '@/lib/timezone';
import { TradeForm } from '@/components/journal/trade-form';

export const dynamic = 'force-dynamic';

export default async function NewTradePage() {
  await requireSession('/journal/new');
  const timeZone = getDashboardTimezone(process.env.DASHBOARD_TIMEZONE);
  return <>
    <div className="page-heading">
      <div><div className="eyebrow">JOURNAL / NEW TRADE</div><h1>Journal a new trade.</h1><p>Capture the trade now, then add your review, screenshots and lessons on the trade page.</p></div>
      <div className="heading-actions"><Link className="button" href="/journal"><ArrowLeft size={13}/>Back to journal</Link></div>
    </div>
    <section className="panel trade-form-panel"><div className="panel-content"><TradeForm timeZone={timeZone} now={new Date().toISOString()}/></div></section>
  </>;
}
