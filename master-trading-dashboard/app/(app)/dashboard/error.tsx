'use client';

import Link from 'next/link';
import { RefreshCw } from 'lucide-react';
import { Brand, EmptyState } from '@/components/dashboard/primitives';

export default function DashboardError({ reset }: { reset: () => void }) {
  return <main className="auth-page"><header className="auth-header"><Brand/></header><div style={{ margin: 'auto', width: 'min(460px, calc(100% - 40px))' }} className="auth-card"><EmptyState title="Your workspace needs a moment" description="Something interrupted this view. Try loading it again." action={<div className="toolbar-group"><button type="button" className="button button-primary" onClick={reset}><RefreshCw size={13}/>Try again</button><Link className="button" href="/login">Back to login</Link></div>}/></div></main>;
}
