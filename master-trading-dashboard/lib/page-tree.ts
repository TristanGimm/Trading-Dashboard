import type { PageTreeNode, WorkspacePageSummary } from './workspace-types.ts';

/** Build a nested page tree from a flat list. Orphaned pages become roots. */
export function buildPageTree(pages: WorkspacePageSummary[]): PageTreeNode[] {
  const nodes = new Map<string, PageTreeNode>();
  for (const page of pages) nodes.set(page.id, { ...page, children: [] });
  const roots: PageTreeNode[] = [];
  for (const page of pages) {
    const node = nodes.get(page.id)!;
    const parent = page.parentId ? nodes.get(page.parentId) : undefined;
    if (parent && parent.id !== node.id) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

export type Breadcrumb = { id: string; title: string; icon: string };

/** Ancestor chain (root first) for a page, with a visited guard for corrupt data. */
export function pageBreadcrumbs(pageId: string, pages: WorkspacePageSummary[]): Breadcrumb[] {
  const byId = new Map(pages.map(page => [page.id, page]));
  const trail: Breadcrumb[] = [];
  const seen = new Set<string>();
  let current = byId.get(pageId);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    trail.unshift({ id: current.id, title: current.title, icon: current.icon });
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return trail;
}
