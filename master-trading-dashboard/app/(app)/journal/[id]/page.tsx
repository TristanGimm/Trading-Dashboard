import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowUpRight, Pencil, Timer } from 'lucide-react';
import { requireSession } from '@/lib/auth';
import { getDashboardTimezone } from '@/lib/timezone';
import { getTrade } from '@/lib/db';
import { ensureTradePage, listPageSummaries } from '@/lib/workspace';
import { recordedOutcome } from '@/lib/execution';
import { money } from '@/lib/format';
import { PageEditor } from '@/components/workspace/page-editor';
import { EditableTradeFacts } from '@/components/journal/editable-trade-facts';
import { AlgorithmTag, ConditionTag, DataTag, SessionTag, SetupTag, TimeframeTag } from '@/components/journal/tags';

export const dynamic = 'force-dynamic';

export default async function TradePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireSession(`/journal/${id}`);
  const trade = await getTrade(id);
  if (!trade) notFound();
  const [pages, notes] = await Promise.all([listPageSummaries('page'), ensureTradePage({ id: trade.id, tradeId: trade.tradeId })]);
  const timeZone = getDashboardTimezone(process.env.DASHBOARD_TIMEZONE);
  const outcome = recordedOutcome(trade);
  const when = trade.dateTime ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(new Date(trade.dateTime)) : 'Unrecorded';
  const confluences = [trade.liquiditySweep && 'Liquidity sweep', trade.dxy && 'DXY confirmation', trade.delta && 'Delta', trade.fractalShift && 'Fractal shift'].filter((value): value is string => Boolean(value));

  return <>
    <div className="trade-page-header">
      <div className="trade-page-heading">
        <Link className="button button-link" href="/journal"><ArrowLeft size={12}/>Back to journal</Link>
        <div className="eyebrow">TRADE REVIEW / {trade.account.join(' · ') || 'NO ACCOUNT'}</div>
        <h1>{trade.pair || 'Unrecorded trade'} <span>#{trade.tradeId}</span></h1>
        <div className="trade-page-meta">
          {trade.position && <span className={`trade-tag ${trade.position.toLowerCase() === 'long' ? 'long' : trade.position.toLowerCase() === 'short' ? 'short' : ''}`}>{trade.position.toLowerCase() === 'long' ? <ArrowUpRight size={11}/> : null}{trade.position}</span>}
          <span className="trade-tag"><Timer size={11}/>{when}</span>
          {outcome && <span className={`trade-tag outcome-${outcome}`}>{outcome}</span>}
          {trade.setup.map(setup => <SetupTag key={setup} value={setup}/>)}
          {trade.algorithm.map(value => <AlgorithmTag key={value} value={value}/>)}
          {trade.sessionTime.map(session => <SessionTag key={session} value={session}/>)}
        </div>
      </div>
      <div className="trade-page-result">
        <span>Realized net P&amp;L</span>
        <strong className={trade.netEur !== null && trade.netEur < 0 ? 'negative' : trade.netEur ? 'positive' : ''}>{trade.netEur === null ? 'Unrecorded' : money(trade.netEur)}</strong>
        <Link className="button" href={`/journal/${trade.id}/edit`}><Pencil size={12}/>Edit trade</Link>
      </div>
    </div>

    <div className="trade-page-grid">
      <section className="panel trade-notes-panel" aria-label="Trade notes">
        <div className="panel-content"><PageEditor page={notes} variant="trade"/></div>
      </section>
      <aside className="trade-facts">
        <section className="panel">
          <div className="panel-heading"><div><h2 className="panel-title">Trade details</h2><p className="panel-subtitle">Click any property to edit it</p></div></div>
          <div className="panel-content"><EditableTradeFacts trade={trade} timeZone={timeZone}/></div>
        </section>
        {(trade.learning || trade.analysisNote) && <section className="panel">
          <div className="panel-heading"><div><h2 className="panel-title">Learning</h2><p className="panel-subtitle">What this trade taught you</p></div></div>
          <div className="panel-content">{trade.learning && <p className="detail-learning">{trade.learning}</p>}{trade.analysisNote && <p className="panel-subtitle analysis-note">{trade.analysisNote}</p>}</div>
        </section>}
        <section className="panel">
          <div className="panel-heading"><div><h2 className="panel-title">Confluences</h2><p className="panel-subtitle">What lined up on this trade</p></div></div>
          <div className="panel-content">
            <div className="confluence-tags">{confluences.length ? confluences.map(value => <DataTag key={value} value={value} tone="grey"/>) : <p className="panel-subtitle">No confluences recorded.</p>}</div>
            {trade.tfType.length > 0 && <div className="confluence-tags">{trade.tfType.map(value => <TimeframeTag key={value} value={value}/>)}</div>}
            {(trade.marketCondition ?? []).length > 0 && <div className="confluence-tags">{trade.marketCondition?.map(value => <ConditionTag key={value} value={value}/>)}</div>}
          </div>
        </section>
        <div className="workspace-note"><p><strong>Screenshots:</strong> paste a chart with ⌘V anywhere in the notes panel — or open this trade from the journal and paste there. Everything stays attached to this trade.</p></div>
      </aside>
    </div>
  </>;
}
