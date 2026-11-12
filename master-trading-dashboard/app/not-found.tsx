import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Brand } from '@/components/dashboard/primitives';

export default function NotFound() {
  return <main className="auth-page"><header className="auth-header"><Brand/></header><section style={{ margin: 'auto', padding: 35, maxWidth: 450, textAlign: 'center' }}><p className="eyebrow">404 / A SMALL DETOUR</p><h1 style={{ fontSize: 32, letterSpacing: -1, lineHeight: 1.25 }}>Let’s get you back on track.</h1><p style={{ color: 'var(--muted)', margin: '18px 0 25px', lineHeight: 1.8 }}>This page isn’t in your workspace. Your journal is still right where you left it.</p><Link className="button button-primary" href="/dashboard">Back to dashboard<ArrowRight size={13}/></Link></section></main>;
}
