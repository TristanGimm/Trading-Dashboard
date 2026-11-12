'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type PendingScreenshot = {
  id: string;
  file: File;
  url: string;
};

export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const MAX_FILE_BYTES = 12 * 1024 * 1024;
const MAX_SCREENSHOTS = 24;

/** Pull image files out of a paste or drop event. Text-only pastes stay untouched. */
export function imageFilesFrom(list: FileList | File[] | null | undefined): File[] {
  if (!list) return [];
  return [...list].filter(file => file.type.startsWith('image/'));
}

/** Clipboard payloads expose files through `items`, `files`, or both. */
export function imagesFromClipboard(data: DataTransfer): File[] {
  // Chromium exposes the same pasted image through both `items` and `files`.
  // Prefer `items`; only fall back to `files` when the browser omits them.
  const fromItems = [...data.items]
    .filter(item => item.kind === 'file')
    .map(item => item.getAsFile())
    .filter((file): file is File => Boolean(file));
  const files = fromItems.length ? fromItems : imageFilesFrom(data.files);
  const seen = new Set<string>();
  return files.filter(file => {
    const key = `${file.name}|${file.size}|${file.lastModified}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function screenshotValidationError(files: File[]): string | null {
  if (!files.length) return null;
  const unsupported = files.find(file => !ACCEPTED_IMAGE_TYPES.includes(file.type));
  if (unsupported) return `${unsupported.name || 'That file'} is not a PNG, JPEG, GIF or WebP image.`;
  const oversized = files.find(file => file.size > MAX_FILE_BYTES);
  if (oversized) return `${oversized.name || 'That image'} is larger than 12 MB.`;
  return null;
}

export function ScreenshotField({ images, onAdd, onRemove, disabled = false }: {
  images: PendingScreenshot[];
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const add = (files: File[]) => {
    if (!disabled) onAdd(files);
  };

  return <div
    className={cn('screenshot-field', dragging && 'is-dragging', disabled && 'is-disabled')}
    onDragOver={event => {
      if (!event.dataTransfer.types.includes('Files')) return;
      event.preventDefault();
      if (!disabled) setDragging(true);
    }}
    onDragLeave={() => setDragging(false)}
    onDrop={event => {
      event.preventDefault();
      setDragging(false);
      add(imageFilesFrom(event.dataTransfer.files));
    }}
  >
    <input
      ref={input}
      type="file"
      accept={ACCEPTED_IMAGE_TYPES.join(',')}
      multiple
      className="sr-only"
      onChange={event => {
        const files = imageFilesFrom(event.target.files);
        event.target.value = '';
        add(files);
      }}
    />
    <button
      type="button"
      className="screenshot-drop"
      disabled={disabled}
      onClick={() => input.current?.click()}
    >
      {disabled ? <Loader2 size={18} className="animate-spin"/> : <ImagePlus size={18}/>}
      <span><strong>Paste a chart screenshot</strong><small>⌘V / Ctrl+V anywhere in this form, or click to choose a file.</small></span>
    </button>
    {images.length > 0 && <div className="screenshot-grid">
      {images.map(image => <figure key={image.id} className="screenshot-thumb">
        <img src={image.url} alt={image.file.name || 'Pasted screenshot'}/>
        <button type="button" className="screenshot-remove" aria-label={`Remove ${image.file.name || 'screenshot'}`} disabled={disabled} onClick={() => onRemove(image.id)}>
          <X size={12}/>
        </button>
      </figure>)}
    </div>}
    {images.length > 0 && <p className="screenshot-caption">{images.length} screenshot{images.length === 1 ? '' : 's'} ready · uploaded when you {disabled ? 'save' : 'create the trade'}.</p>}
    {images.length === 0 && <p className="screenshot-caption">Up to 24 images. They are stored with this trade and appear in its notes.</p>}
  </div>;
}
