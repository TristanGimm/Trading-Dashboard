'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookOpen, CalendarDays, ChevronRight, Compass, LayoutDashboard, LogOut, PenLine,
  SlidersHorizontal, TableProperties,
} from 'lucide-react';
import { signOut } from '@/app/login/actions';
import { Brand } from '@/components/dashboard/primitives';
import { ProductSwitcher } from '@/components/product-switcher';
import { VideoBackdrop } from '@/components/video-backdrop';
import { ThemeToggle } from '@/components/theme-toggle';
import { NewPageButton } from '@/components/workspace/new-page-button';
import { PageTree } from '@/components/workspace/page-tree';
import { buildPageTree } from '@/lib/page-tree';
import type { WorkspacePageSummary } from '@/lib/workspace-types';
import { cn } from '@/lib/utils';

export type ShellSection = 'workspace' | 'strategy' | 'overview' | 'journal' | 'calendar' | 'analytics';

const navigation = [
  { id: 'overview' as const, label: 'Overview', icon: LayoutDashboard, href: '/dashboard' },
  { id: 'calendar' as const, label: 'Trading Calendar', icon: CalendarDays, href: '/calendar' },
  { id: 'journal' as const, label: 'Trading Journal', icon: TableProperties, href: '/journal' },
  { id: 'strategy' as const, label: 'Trading Strategy', icon: Compass, href: '/strategy' },
  { id: 'analytics' as const, label: 'Analytics', icon: SlidersHorizontal, href: '/analytics' },
  { id: 'workspace' as const, label: 'Notes', icon: BookOpen, href: '/workspace' },
];

const mobileLabels: Record<ShellSection, string> = {
  overview: 'Overview', calendar: 'Calendar', journal: 'Journal',
  strategy: 'Strategy', analytics: 'Analytics', workspace: 'Notes',
};

/**
 * Section comes from the path alone. Reading search params here would suspend
 * the shell on every navigation and tear the whole sidebar down.
 */
function sectionOf(pathname: string): ShellSection {
  if (pathname === '/workspace' || pathname.startsWith('/workspace/')) return 'workspace';
  if (pathname === '/strategy' || pathname.startsWith('/strategy/')) return 'strategy';
  if (pathname === '/journal' || pathname.startsWith('/journal/')) return 'journal';
  if (pathname === '/calendar') return 'calendar';
  if (pathname === '/analytics') return 'analytics';
  return 'overview';
}

export function AppShell({ pages, demo, timeZone, children }: {
  pages: WorkspacePageSummary[];
  demo: boolean;
  timeZone: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname() || '/dashboard';
  const section = sectionOf(pathname);
  const tree = useMemo(() => buildPageTree(pages), [pages]);
  const activePage = pathname.startsWith('/workspace/') ? pages.find(page => `/workspace/${page.id}` === pathname) : undefined;
  const crumbs: { label: string; href?: string }[] = (() => {
    switch (section) {
      case 'workspace':
        return activePage ? [{ label: 'Notes', href: '/workspace' }, { label: activePage.title }] : [{ label: 'Notes' }];
      case 'strategy':
        return [{ label: 'Trading Strategy' }];
      case 'journal':
        if (pathname === '/journal/new') return [{ label: 'Trading Journal', href: '/journal' }, { label: 'New trade' }];
        if (pathname.endsWith('/edit')) return [{ label: 'Trading Journal', href: '/journal' }, { label: 'Edit trade' }];
        if (pathname.startsWith('/journal/')) return [{ label: 'Trading Journal', href: '/journal' }, { label: 'Trade review' }];
        return [{ label: 'Trading Journal' }];
      case 'calendar':
        return [{ label: 'Trading Calendar' }];
      case 'analytics':
        return [{ label: 'Analytics' }];
      default:
        return [{ label: 'Overview' }];
    }
  })();


  return <div className="workspace">
    <VideoBackdrop variant="ambient"/>
    <a href="#workspace-content" className="skip-link">Skip to content</a>
    <aside className="app-sidebar" aria-label="Workspace sidebar">
      <Link href="/dashboard" aria-label="Trading Dashboard home"><Brand/></Link>
      <p className="nav-caption">NAVIGATION</p>
      <nav aria-label="Main navigation">
        {navigation.filter(item => !demo || !['workspace', 'strategy'].includes(item.id)).map(item => (
          <Link key={item.id} href={item.href} prefetch={true} aria-current={section === item.id ? 'page' : undefined} className={cn('nav-item', section === item.id && 'active')}>
            <item.icon size={17} strokeWidth={1.7}/>{item.label}
          </Link>
        ))}
      </nav>
      {!demo && <>
        <div className="sidebar-page-heading"><p className="nav-caption">NOTES</p><NewPageButton compact/></div>
        <div className="sidebar-pages">{tree.length ? <PageTree nodes={tree} activeId={activePage?.id}/> : <p className="sidebar-pages-empty">No pages yet. Create your first note.</p>}</div>
      </>}
      <div className="sidebar-bottom">
        <div className="source-card">
          {demo
            ? <p>Synthetic trades for the local preview. Nothing is written to a database.</p>
            : <div className="quick-actions"><Link href="/journal/new" className="button button-primary"><PenLine size={12}/>New trade</Link><NewPageButton label="New note"/></div>}
        </div>
        <div className="sidebar-profile">
          <form action={signOut}><button type="submit" className="button sidebar-logout" aria-label="Log out"><LogOut size={13}/>Log out</button></form>
        </div>
      </div>
    </aside>

    <div className="workspace-main">
      <header className="page-topbar">
        <div className="topbar-left">
          <div className="mobile-brand"><Brand/></div>
          <ProductSwitcher variant="light"/>
          <div className="breadcrumbs">
            <BookOpen size={13}/>
            {crumbs.map((crumb, index) => <span key={`${crumb.label}-${index}`} className="crumb-part">
              {index > 0 && <ChevronRight size={11}/>}
              {crumb.href ? <Link href={crumb.href}>{crumb.label}</Link> : <strong>{crumb.label}</strong>}
            </span>)}
          </div>
        </div>
        <div className="topbar-actions">
          <ThemeToggle/>
          <span className={cn('status-pill', !demo && 'status-ok')}><span className="status-dot"/>{demo ? 'Demo' : 'Local'}</span>
          <span className="sync-caption hide-mobile">{timeZone}</span>
          <form action={signOut} className="mobile-brand"><button type="submit" className="icon-button" aria-label="Log out"><LogOut size={14}/></button></form>
        </div>
      </header>
      <main id="workspace-content" className="dashboard-content">
        {children}
      </main>
    </div>

    <nav className="mobile-nav" aria-label="Mobile navigation">
      {navigation.filter(item => !demo || !['workspace', 'strategy'].includes(item.id)).map(item => (
        <Link key={item.id} href={item.href} prefetch={true} aria-current={section === item.id ? 'page' : undefined} className={section === item.id ? 'active' : ''}>
          <item.icon size={18} strokeWidth={1.7}/>{mobileLabels[item.id]}
        </Link>
      ))}
    </nav>
  </div>;
}
