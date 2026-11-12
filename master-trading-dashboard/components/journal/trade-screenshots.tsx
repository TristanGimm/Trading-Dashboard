'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ImagePlus, Loader2, Trash2, X } from 'lucide-react';
import type { Trade } from '@/lib/types';
import { cn } from '@/lib/utils';
import { imagesFromClipboard, screenshotValidationError } from './screenshot-field';

type Shot = { id: string; caption: string | null; pending?: boolean; localUrl?: string };

/**
 * Screenshots on an existing trade.
 *
 * The panel listens for a paste anywhere outside a text field, so opening a
 * trade and pressing ⌘V is enough — no need to find the trade page first.
 */
export function TradeScreenshots({ trade, disabled = false }: {
  trade: Trade;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [shots, setShots] = useState<Shot[]>(() => (trade.screenshots ?? []).map(shot => ({ ...shot })));
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setShots((trade.screenshots ?? []).map(shot => ({ ...shot })));
  }, [trade.id]);

  const upload = async (files: File[]) => {
    if (disabled || !files.length) return;
    const validation = screenshotValidationError(files);
    if (validation) { setError(validation); return; }
    setError(null);
    setUploading(true);
    for (const file of files) {
      const placeholder = `pending-${crypto.randomUUID()}`;
      const localUrl = URL.createObjectURL(file);
      setShots(previous => [...previous, { id: placeholder, caption: file.name || 'Screenshot', pending: true, localUrl }]);
      try {
        const body = new FormData();
        body.set('file', file);
        const response = await fetch(`/api/trades/${trade.id}/screenshots`, { method: 'POST', body });
        const payload = await response.json().catch(() => ({})) as { asset?: { id: string; caption: string }; error?: string };
        if (!response.ok || !payload.asset) throw new Error(payload.error || 'Could not upload the screenshot.');
        setShots(previous => previous.map(shot => shot.id === placeholder
          ? { id: payload.asset!.id, caption: payload.asset!.caption, pending: false }
          : shot));
        router.refresh();
      } catch (reason) {
        setShots(previous => previous.filter(shot => shot.id !== placeholder));
        setError(reason instanceof Error ? reason.message : 'Could not upload the screenshot.');
      } finally {
        URL.revokeObjectURL(localUrl);
      }
    }
    setUploading(false);
  };

  useEffect(() => {
    if (disabled) return;
    const onPaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      // Pasting into a number or note field must stay a normal text paste.
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (!event.clipboardData) return;
      const files = imagesFromClipboard(event.clipboardData);
      if (!files.length) return;
      event.preventDefault();
      void upload(files);
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, trade.id]);

  const remove = async (shot: Shot) => {
    if (shot.pending || disabled) return;
    const previous = shots;
    setShots(current => current.filter(item => item.id !== shot.id));
    try {
      const response = await fetch(`/api/trades/${trade.id}/screenshots?assetId=${shot.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Could not remove the screenshot.');
      router.refresh();
    } catch (reason) {
      setShots(previous);
      setError(reason instanceof Error ? reason.message : 'Could not remove the screenshot.');
    }
  };

  return <section className="dialog-section screenshot-section">
    <div className="screenshot-section-heading">
      <h3>Screenshots</h3>
      <span className="screenshot-section-hint">{disabled ? 'Sample trade' : 'Press ⌘V / Ctrl+V to paste'}</span>
    </div>
    <div
      className={cn('screenshot-paste', dragging && 'is-dragging', disabled && 'is-disabled')}
      onDragOver={event => {
        if (!event.dataTransfer.types.includes('Files')) return;
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={event => {
        event.preventDefault();
        setDragging(false);
        void upload([...event.dataTransfer.files].filter(file => file.type.startsWith('image/')));
      }}
    >
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        multiple
        className="sr-only"
        onChange={event => {
          const files = [...(event.target.files || [])].filter(file => file.type.startsWith('image/'));
          event.target.value = '';
          void upload(files);
        }}
      />
      {shots.length > 0 && <div className="screenshot-grid compact">
        {shots.map(shot => <figure key={shot.id} className={cn('screenshot-thumb', shot.pending && 'is-pending')}>
          <button
            type="button"
            className="screenshot-open"
            aria-label={shot.pending ? 'Uploading screenshot' : `View screenshot ${shot.caption || ''}`}
            onClick={() => { if (!shot.pending) setViewing(`/api/assets/${shot.id}`); }}
          >
            <img src={shot.localUrl ?? `/api/assets/${shot.id}`} alt={shot.caption || 'Trade screenshot'} loading="lazy"/>
          </button>
          {shot.pending
            ? <span className="screenshot-pending"><Loader2 size={12} className="animate-spin"/></span>
            : !disabled && <button type="button" className="screenshot-remove" aria-label={`Remove ${shot.caption || 'screenshot'}`} onClick={() => void remove(shot)}><X size={12}/></button>}
        </figure>)}
      </div>}
      <div className="screenshot-actions">
        <button type="button" className="button" disabled={disabled || uploading} onClick={() => input.current?.click()}>
          {uploading ? <Loader2 size={13} className="animate-spin"/> : <ImagePlus size={13}/>}
          {uploading ? 'Uploading…' : shots.length ? 'Add another' : 'Add screenshot'}
        </button>
        <span className="screenshot-paste-hint">or drop an image here</span>
      </div>
    </div>
    {error && <div className="editor-error" role="alert"><AlertCircle size={14}/>{error}</div>}
    {!disabled && shots.length > 0 && <p className="screenshot-caption">{shots.length} screenshot{shots.length === 1 ? '' : 's'} on this trade · stored in its notes page.</p>}

    {viewing && <div className="screenshot-lightbox" role="dialog" aria-modal="true" aria-label="Screenshot" onClick={() => setViewing(null)}>
      <button type="button" className="screenshot-lightbox-close" aria-label="Close screenshot" onClick={() => setViewing(null)}><X size={16}/></button>
      <img src={viewing} alt="Trade screenshot"/>
      <a className="button" href={viewing} target="_blank" rel="noreferrer">Open full size</a>
    </div>}
  </section>;
}
