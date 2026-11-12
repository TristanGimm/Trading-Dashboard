export type BlockType =
  | 'paragraph'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'bulleted'
  | 'numbered'
  | 'todo'
  | 'quote'
  | 'callout'
  | 'code'
  | 'divider'
  | 'image';

export type Block = {
  id: string;
  type: BlockType;
  text: string;
  checked?: boolean;
  assetId?: string;
  caption?: string;
};

export type PageContent = { blocks: Block[] };

export type WorkspacePageKind = 'page' | 'trade';

export type WorkspacePageSummary = {
  id: string;
  parentId: string | null;
  title: string;
  icon: string;
  kind: WorkspacePageKind;
  tradeId: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
};

export type WorkspacePage = WorkspacePageSummary & { content: PageContent };

export type PageTreeNode = WorkspacePageSummary & { children: PageTreeNode[] };

export const emptyPageContent: PageContent = { blocks: [] };
