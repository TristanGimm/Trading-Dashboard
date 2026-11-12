import Link from 'next/link';
import { ArrowRight, BookOpen, Image as ImageIcon, PenLine, Sparkles, TableProperties } from 'lucide-react';
import { requireSession } from '@/lib/auth';
import { getDashboardTimezone } from '@/lib/timezone';
import { listPageSummaries, listRecentPages, workspaceStats } from '@/lib/workspace';
import { NewPageButton } from '@/components/workspace/new-page-button';

export const dynamic = 'force-dynamic';

export default async function WorkspaceHome() {
  await requireSession('/workspace');
  const timeZone = getDashboardTimezone(process.env.DASHBOARD_TIMEZONE);
  const [pages, recent, stats] = await Promise.all([listPageSummaries('page'), listRecentPages(6), workspaceStats()]);
  const updated = stats.lastUpdated
    ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(new Date(stats.lastUpdated))
    : 'Not yet';

  return <>
    <div className="page-heading workspace-hero">
      <div>
        <h1>Notes</h1>
        <div className="heading-actions">
          <Link href="/journal/new" className="button button-primary"><PenLine size={13}/>New trade</Link>
          <NewPageButton label="New page"/>
        </div>
      </div>
      <div className="workspace-stat-grid">
        <div className="workspace-stat"><span>Trades</span><strong>{stats.trades}</strong></div>
        <div className="workspace-stat"><span>Pages</span><strong>{stats.pages}</strong></div>
        <div className="workspace-stat"><span>Screenshots</span><strong>{stats.screenshots}</strong></div>
        <div className="workspace-stat"><span>Last change</span><strong className="workspace-stat-date">{updated}</strong></div>
      </div>
    </div>

    <div className="workspace-grid">
      <section className="panel workspace-recent">
        <div className="panel-heading"><div><h2 className="panel-title">Recently edited</h2><p className="panel-subtitle">Pages and notes from your workspace.</p></div><BookOpen size={15} className="muted"/></div>
        <div className="panel-content">
          {recent.length ? <div className="recent-page-list">{recent.map(page => <Link key={page.id} href={page.kind === 'trade' && page.tradeId ? `/journal/${page.tradeId}` : `/workspace/${page.id}`} className="recent-page">
            <span className="recent-page-icon" aria-hidden="true">{page.icon}</span>
            <span className="recent-page-body"><strong>{page.title || 'Untitled'}</strong><small>{page.kind === 'trade' ? 'Trade notes' : 'Page'} · {new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone }).format(new Date(page.updatedAt))}</small></span>
            <ArrowRight size={13}/>
          </Link>)}</div> : <div className="empty-state workspace-empty"><span className="empty-icon"><BookOpen size={20}/></span><h3>Your workspace is empty.</h3><p>Start with a playbook page or journal your next trade.</p><div className="heading-actions"><NewPageButton label="Create a page"/><Link href="/journal/new" className="button">Journal a trade</Link></div></div>}
        </div>
      </section>

      <div className="workspace-side">
        <Link href="/journal" className="workspace-card">
          <span className="workspace-card-icon"><TableProperties size={18}/></span>
          <div><h3>Trading Journal</h3><p>Browse every trade with filters, stats and CSV export.</p></div>
          <ArrowRight size={14}/>
        </Link>
        <Link href="/journal/new" className="workspace-card">
          <span className="workspace-card-icon"><PenLine size={18}/></span>
          <div><h3>Quick capture</h3><p>Log a trade, then add your review and screenshots.</p></div>
          <ArrowRight size={14}/>
        </Link>
        <Link href="/analytics" className="workspace-card">
          <span className="workspace-card-icon"><Sparkles size={18}/></span>
          <div><h3>Your edge</h3><p>Setups, sessions and confluence performance.</p></div>
          <ArrowRight size={14}/>
        </Link>
        <div className="workspace-note"><ImageIcon size={15}/><p><strong>Screenshots welcome.</strong> Paste with ⌘V or drag charts straight into any page or trade note.</p></div>
      </div>
    </div>

    <section className="panel workspace-playbook">
      <div className="panel-heading"><div><h2 className="panel-title">Start your playbook</h2><p className="panel-subtitle">Pages support headings, lists, to-dos, quotes, code, images and subpages.</p></div><NewPageButton label="Add page"/></div>
      <div className="panel-content workspace-page-grid">
        {pages.slice(0, 8).map(page => <Link key={page.id} href={`/workspace/${page.id}`} className="workspace-page-card"><span>{page.icon}</span><strong>{page.title || 'Untitled'}</strong><small>Edited {new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone }).format(new Date(page.updatedAt))}</small></Link>)}
        {!pages.length && <div className="workspace-page-card is-placeholder"><span>📘</span><strong>Your first page</strong><small>Define your process, setups and rules.</small></div>}
      </div>
    </section>
  </>;
}
