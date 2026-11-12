'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export function NewPageButton({ parentId, label = 'New page', compact = false, className }: {
  parentId?: string;
  label?: string;
  compact?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const create = async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch('/api/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId: parentId || null }),
      });
      const payload = await response.json() as { page?: { id: string }; error?: string };
      if (!response.ok || !payload.page) throw new Error(payload.error || 'Could not create the page.');
      router.push(`/workspace/${payload.page.id}`);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not create the page.');
      setPending(false);
    }
  };
  return <button
    type="button"
    className={cn(compact ? 'icon-button' : 'button', className)}
    onClick={create}
    disabled={pending}
    title={error || label}
    aria-label={label}
  >
    {pending ? <Loader2 size={14} className="animate-spin"/> : <Plus size={compact ? 15 : 13}/>}
    {!compact && <span>{label}</span>}
    {error && <span className="sr-only" role="alert">{error}</span>}
  </button>;
}
