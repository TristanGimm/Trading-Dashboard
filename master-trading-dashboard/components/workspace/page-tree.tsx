import Link from 'next/link';
import type { PageTreeNode } from '@/lib/workspace-types';
import { cn } from '@/lib/utils';

export function PageTree({ nodes, activeId, depth = 0 }: { nodes: PageTreeNode[]; activeId?: string; depth?: number }) {
  if (!nodes.length || depth > 8) return null;
  return <div className="page-tree">
    {nodes.map(node => <div key={node.id}>
      <Link href={`/workspace/${node.id}`} className={cn('page-tree-item', activeId === node.id && 'active')} style={{ paddingLeft: 10 + depth * 14 }}>
        <span className="page-tree-icon" aria-hidden="true">{node.icon || '📄'}</span>
        <span className="page-tree-title">{node.title || 'Untitled'}</span>
      </Link>
      <PageTree nodes={node.children} activeId={activeId} depth={depth + 1}/>
    </div>)}
  </div>;
}
