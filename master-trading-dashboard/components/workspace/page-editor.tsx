'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle, Check, ChevronDown, Code2, Heading1, Heading2, Heading3, Image as ImageIcon,
  Lightbulb, List, ListOrdered, Loader2, Minus, Plus, Quote, Trash2, Type,
} from 'lucide-react';
import type { Block, BlockType, WorkspacePage } from '@/lib/workspace-types';
import { cn } from '@/lib/utils';
import { NewPageButton } from './new-page-button';

type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';
type BlockMenu = { blockId: string; mode: 'insert' | 'convert' } | null;

const blockOptions: { type: BlockType; label: string; icon: typeof Type }[] = [
  { type: 'paragraph', label: 'Text', icon: Type },
  { type: 'heading1', label: 'Heading 1', icon: Heading1 },
  { type: 'heading2', label: 'Heading 2', icon: Heading2 },
  { type: 'heading3', label: 'Heading 3', icon: Heading3 },
  { type: 'bulleted', label: 'Bulleted list', icon: List },
  { type: 'numbered', label: 'Numbered list', icon: ListOrdered },
  { type: 'todo', label: 'To-do', icon: Check },
  { type: 'quote', label: 'Quote', icon: Quote },
  { type: 'callout', label: 'Callout', icon: Lightbulb },
  { type: 'code', label: 'Code', icon: Code2 },
  { type: 'divider', label: 'Divider', icon: Minus },
  { type: 'image', label: 'Image', icon: ImageIcon },
];

const placeholders: Record<BlockType, string> = {
  paragraph: "Write something, or type '/' for blocks…",
  heading1: 'Heading 1',
  heading2: 'Heading 2',
  heading3: 'Heading 3',
  bulleted: 'List item',
  numbered: 'List item',
  todo: 'To-do',
  quote: 'Quote',
  callout: 'Callout',
  code: 'Code',
  divider: '',
  image: '',
};

function newBlock(type: BlockType = 'paragraph'): Block {
  return { id: crypto.randomUUID(), type, text: '', ...(type === 'todo' ? { checked: false } : {}) };
}

function blockClass(type: BlockType): string {
  return `block-${type}`;
}

export function PageEditor({ page, variant = 'page' }: { page: WorkspacePage; variant?: 'page' | 'trade' }) {
  const router = useRouter();
  const initialBlocks: Block[] = page.content.blocks.length
    ? page.content.blocks
    : [{ id: `initial-${page.id}`, type: 'paragraph', text: '' }];
  const [title, setTitle] = useState(page.title);
  const [icon, setIcon] = useState(page.icon);
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState<BlockMenu>(null);
  const [uploading, setUploading] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [focusRequest, setFocusRequest] = useState<{ id: string; tick: number } | null>(null);
  const focusTick = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadAnchor = useRef<string | null>(null);
  const focused = useRef<string | null>(null);
  const dirty = useRef(false);
  const saving = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ title, icon, blocks });

  useEffect(() => { latest.current = { title, icon, blocks }; }, [title, icon, blocks]);

  const save = useCallback(async () => {
    if (!dirty.current || saving.current) return;
    saving.current = true;
    dirty.current = false;
    setStatus('saving');
    setError(null);
    try {
      const response = await fetch(`/api/pages/${page.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: latest.current.title, icon: latest.current.icon, content: { blocks: latest.current.blocks } }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error || 'Could not save the page.');
      }
      setStatus(dirty.current ? 'dirty' : 'saved');
    } catch (reason) {
      dirty.current = true;
      setStatus('error');
      setError(reason instanceof Error ? reason.message : 'Could not save the page.');
    } finally {
      saving.current = false;
      if (dirty.current) timer.current = setTimeout(() => void save(), 1500);
    }
  }, [page.id]);

  const markDirty = useCallback(() => {
    dirty.current = true;
    setStatus('dirty');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), 900);
  }, [save]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    if (!dirty.current) return;
    fetch(`/api/pages/${page.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: latest.current.title, icon: latest.current.icon, content: { blocks: latest.current.blocks } }),
      keepalive: true,
    }).catch(() => {});
  }, [page.id]);

  const focusBlock = (id: string) => {
    requestAnimationFrame(() => {
      const element = document.querySelector<HTMLTextAreaElement>(`[data-block-input="${id}"]`);
      if (!element) return;
      element.focus();
      element.setSelectionRange(element.value.length, element.value.length);
    });
  };

  const requestFocus = (id: string | null) => {
    if (!id) return;
    focusTick.current += 1;
    setFocusRequest({ id, tick: focusTick.current });
  };

  useEffect(() => { if (focusRequest) focusBlock(focusRequest.id); }, [focusRequest]);

  useEffect(() => {
    if (!menu) return;
    const close = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (target?.closest('.block-menu') || target?.closest('[data-block-menu-trigger]')) return;
      setMenu(null);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenu(null); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', escape); };
  }, [menu]);

  const updateBlock = (id: string, patch: Partial<Block>) => {
    setBlocks(previous => previous.map(block => block.id === id ? { ...block, ...patch } : block));
    markDirty();
  };

  const insertBlock = (afterId: string | null, block: Block) => {
    setBlocks(previous => {
      const index = afterId ? previous.findIndex(item => item.id === afterId) : previous.length - 1;
      return [...previous.slice(0, index + 1), block, ...previous.slice(index + 1)];
    });
    markDirty();
    requestFocus(block.id);
    return block;
  };

  const addBlock = (afterId: string | null, type: BlockType = 'paragraph') => {
    if (type === 'image') {
      uploadAnchor.current = afterId;
      fileInput.current?.click();
      return;
    }
    insertBlock(afterId, newBlock(type));
  };

  const removeBlock = (id: string) => {
    const block = blocks.find(item => item.id === id);
    if (!block) return;
    if (block.type === 'image' && block.assetId) {
      fetch(`/api/assets/${block.assetId}`, { method: 'DELETE' }).catch(() => {});
    }
    setBlocks(previous => {
      if (previous.length === 1) return [{ ...previous[0], type: 'paragraph', text: '', checked: false }];
      return previous.filter(item => item.id !== id);
    });
    const index = blocks.findIndex(item => item.id === id);
    const neighbour = blocks[index - 1] || blocks[index + 1];
    if (neighbour) requestFocus(neighbour.id);
    markDirty();
  };

  const uploadFiles = async (files: File[], afterId: string | null) => {
    let anchor = afterId;
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      setUploading(count => count + 1);
      setError(null);
      try {
        const body = new FormData();
        body.set('pageId', page.id);
        body.set('file', file);
        const response = await fetch('/api/assets', { method: 'POST', body });
        const payload = await response.json().catch(() => ({})) as { asset?: { id: string }; error?: string };
        if (!response.ok || !payload.asset) throw new Error(payload.error || 'Upload failed.');
        const block = insertBlock(anchor, { id: crypto.randomUUID(), type: 'image', text: '', assetId: payload.asset.id, caption: '' });
        anchor = block.id;
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Upload failed.');
      } finally {
        setUploading(count => count - 1);
      }
    }
  };

  const chooseType = (block: Block, type: BlockType) => {
    setMenu(null);
    if (type === 'image') {
      uploadAnchor.current = block.id;
      fileInput.current?.click();
      return;
    }
    if (menu?.mode === 'insert') addBlock(block.id, type);
    else updateBlock(block.id, { type, text: block.text === '/' ? '' : block.text });
    requestFocus(block.id);
  };

  const onPaste = (event: React.ClipboardEvent) => {
    const files = [...event.clipboardData.items]
      .filter(item => item.kind === 'file')
      .map(item => item.getAsFile())
      .filter((file): file is File => Boolean(file));
    if (!files.length) return;
    event.preventDefault();
    void uploadFiles(files, focused.current || blocks.at(-1)?.id || null);
  };

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const files = [...event.dataTransfer.files].filter(file => file.type.startsWith('image/'));
    if (files.length) void uploadFiles(files, focused.current || blocks.at(-1)?.id || null);
  };

  const deleteThisPage = async () => {
    if (!window.confirm('Delete this page and every subpage?')) return;
    const response = await fetch(`/api/pages/${page.id}`, { method: 'DELETE' });
    if (!response.ok) { setError('Could not delete the page.'); return; }
    router.push('/workspace');
    router.refresh();
  };

  const numberedPosition = (index: number) => {
    let position = 0;
    for (let cursor = index; cursor >= 0 && blocks[cursor].type === 'numbered'; cursor--) position++;
    return position;
  };

  return <div className={cn('page-editor', dragging && 'is-dragging')} onPaste={onPaste} onDragOver={event => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); setDragging(true); } }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
    <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="sr-only" onChange={event => { const files = [...(event.target.files || [])]; event.target.value = ''; if (files.length) void uploadFiles(files, uploadAnchor.current); }}/>
    {variant === 'page' ? <div className="editor-heading">
      <div className="editor-icon-wrap"><input className="editor-icon" aria-label="Page icon" value={icon} maxLength={8} onChange={event => { setIcon(event.target.value); markDirty(); }}/></div>
      <input className="editor-title" aria-label="Page title" value={title} placeholder="Untitled" onChange={event => { setTitle(event.target.value); markDirty(); }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); requestFocus(blocks[0]?.id || null); } }}/>
      <div className="editor-toolbar">
        <SaveState status={status} uploading={uploading}/>
        <NewPageButton parentId={page.id} label="Subpage" compact/>
        <button type="button" className="icon-button" onClick={deleteThisPage} aria-label="Delete page" title="Delete page"><Trash2 size={14}/></button>
      </div>
    </div> : <div className="trade-notes-heading"><div><h2>Notes &amp; screenshots</h2><p>Write your review, paste chart screenshots with ⌘V, or drop images here.</p></div><div className="editor-toolbar"><SaveState status={status} uploading={uploading}/></div></div>}
    {error && <div className="editor-error" role="alert"><AlertCircle size={14}/>{error}</div>}
    <div className="editor-blocks">
      {blocks.map((block, index) => <div key={block.id} className={cn('editor-block', blockClass(block.type), block.checked && 'is-done', menu?.blockId === block.id && 'menu-open')}>
        <div className="block-actions">
          <button type="button" className="block-action" aria-label="Add block below" title="Add block below" onClick={() => addBlock(block.id)}><Plus size={13}/></button>
          <button type="button" className="block-action" aria-label="Change block type" title="Change block type" data-block-menu-trigger onClick={() => setMenu(menu?.blockId === block.id ? null : { blockId: block.id, mode: 'convert' })}><ChevronDown size={13}/></button>
        </div>
        {block.type === 'divider' ? <div className="block-divider"><hr/><button type="button" className="block-remove" aria-label="Remove divider" onClick={() => removeBlock(block.id)}><Trash2 size={12}/></button></div>
          : block.type === 'image' ? <figure className="block-image">
            {block.assetId ? <img src={`/api/assets/${block.assetId}`} alt={block.caption || 'Trade screenshot'} loading="lazy"/> : <div className="image-placeholder">Image missing</div>}
            <div className="image-caption-row"><input value={block.caption || ''} placeholder="Add a caption…" aria-label="Image caption" onChange={event => updateBlock(block.id, { caption: event.target.value })}/><button type="button" className="block-remove" aria-label="Remove image" onClick={() => removeBlock(block.id)}><Trash2 size={12}/></button></div>
          </figure>
          : <div className="block-content">
            {block.type === 'todo' && <button type="button" className={cn('todo-check', block.checked && 'checked')} aria-label={block.checked ? 'Mark as not done' : 'Mark as done'} aria-pressed={block.checked} onClick={() => updateBlock(block.id, { checked: !block.checked })}>{block.checked && <Check size={11}/>}</button>}
            {block.type === 'bulleted' && <span className="block-marker" aria-hidden="true">•</span>}
            {block.type === 'numbered' && <span className="block-marker" aria-hidden="true">{numberedPosition(index)}.</span>}
            {block.type === 'callout' && <span className="callout-icon" aria-hidden="true"><Lightbulb size={15}/></span>}
            <textarea
              ref={element => { if (element) { element.style.height = '0px'; element.style.height = `${element.scrollHeight}px`; } }}
              className="block-input"
              data-block-input={block.id}
              rows={1}
              value={block.text}
              placeholder={placeholders[block.type]}
              aria-label={placeholders[block.type] || 'Text block'}
              onFocus={() => { focused.current = block.id; }}
              onChange={event => {
                const value = event.target.value;
                updateBlock(block.id, { text: value });
                if (block.type !== 'code') setMenu(value === '/' ? { blockId: block.id, mode: 'convert' } : menu?.blockId === block.id ? null : menu);
              }}
              onKeyDown={event => {
                if (event.key === 'Escape') { setMenu(null); return; }
                if (event.key === ' ' && block.type !== 'code') {
                  const shortcuts: Record<string, BlockType> = { '#': 'heading1', '##': 'heading2', '###': 'heading3', '-': 'bulleted', '*': 'bulleted', '1.': 'numbered', '[]': 'todo', '>': 'quote' };
                  if (shortcuts[block.text]) {
                    event.preventDefault();
                    updateBlock(block.id, { type: shortcuts[block.text], text: '' });
                    return;
                  }
                }
                if (event.key === 'Enter' && !event.shiftKey && block.type !== 'code') {
                  event.preventDefault();
                  addBlock(block.id, ['bulleted', 'numbered', 'todo'].includes(block.type) ? block.type : 'paragraph');
                  return;
                }
                if (event.key === 'Backspace' && block.text === '' && blocks.length > 1) {
                  event.preventDefault();
                  removeBlock(block.id);
                  return;
                }
                const element = event.currentTarget;
                if (event.key === 'ArrowUp' && element.selectionStart === 0 && index > 0) {
                  event.preventDefault();
                  requestFocus(blocks[index - 1].id);
                }
                if (event.key === 'ArrowDown' && element.selectionStart === element.value.length && index < blocks.length - 1) {
                  event.preventDefault();
                  requestFocus(blocks[index + 1].id);
                }
              }}
            />
            {block.checked && <span className="sr-only">Done</span>}
          </div>}
        {menu?.blockId === block.id && <div className="block-menu" role="menu" aria-label="Block type">
          {blockOptions.map(option => <button key={option.type} type="button" role="menuitem" className={cn(block.type === option.type && 'selected')} onMouseDown={event => event.preventDefault()} onClick={() => chooseType(block, option.type)}><option.icon size={14}/><span>{option.label}</span></button>)}
          <button type="button" role="menuitem" className="danger" onMouseDown={event => event.preventDefault()} onClick={() => { setMenu(null); removeBlock(block.id); }}><Trash2 size={14}/><span>Delete block</span></button>
        </div>}
      </div>)}
    </div>
    <div className="editor-footer-actions">
      <button type="button" className="button" onClick={() => addBlock(blocks.at(-1)?.id || null)}><Plus size={13}/>Add block</button>
      <button type="button" className="button" onClick={() => { uploadAnchor.current = blocks.at(-1)?.id || null; fileInput.current?.click(); }} disabled={uploading > 0}>{uploading > 0 ? <Loader2 size={13} className="animate-spin"/> : <ImageIcon size={13}/>}Add screenshot</button>
      <span className="editor-hint">Paste or drop images directly into the page.</span>
    </div>
    {dragging && <div className="editor-drop-overlay"><ImageIcon size={26}/><strong>Drop screenshots to upload</strong></div>}
  </div>;
}

function SaveState({ status, uploading }: { status: SaveStatus; uploading: number }) {
  if (uploading > 0) return <span className="save-state saving"><Loader2 size={12} className="animate-spin"/>Uploading…</span>;
  if (status === 'saving') return <span className="save-state saving"><Loader2 size={12} className="animate-spin"/>Saving…</span>;
  if (status === 'error') return <span className="save-state error"><AlertCircle size={12}/>Not saved</span>;
  if (status === 'dirty') return <span className="save-state dirty">Unsaved changes</span>;
  if (status === 'saved') return <span className="save-state saved"><Check size={12}/>Saved</span>;
  return <span className="save-state">Autosave on</span>;
}
