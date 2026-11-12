import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPageTree, pageBreadcrumbs } from '../lib/page-tree.ts';
import { dateTimeInputToIso, isoToDateTimeInput } from '../lib/datetime.ts';
import type { WorkspacePageSummary } from '../lib/workspace-types.ts';

const page = (id: string, parentId: string | null, title = id): WorkspacePageSummary => ({
  id, parentId, title, icon: '📄', kind: 'page', tradeId: null, position: 0,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
});

test('page tree nests children, keeps orphaned pages at the root and ignores self parents', () => {
  const tree = buildPageTree([page('root', null), page('child', 'root'), page('grandchild', 'child'), page('orphan', 'missing'), page('loop', 'loop')]);
  assert.deepEqual(tree.map(node => node.id).sort(), ['loop', 'orphan', 'root']);
  const root = tree.find(node => node.id === 'root')!;
  assert.equal(root.children[0].id, 'child');
  assert.equal(root.children[0].children[0].id, 'grandchild');
  assert.equal(tree.find(node => node.id === 'loop')!.children.length, 0);
});

test('breadcrumbs return the ancestor chain and stop on corrupt cycles', () => {
  const pages = [page('root', null, 'Root'), page('child', 'root', 'Child')];
  assert.deepEqual(pageBreadcrumbs('child', pages).map(crumb => crumb.title), ['Root', 'Child']);
  const cyclic = [page('a', 'b'), page('b', 'a')];
  assert.equal(pageBreadcrumbs('a', cyclic).length, 2);
});

test('datetime-local values convert through the configured timezone', () => {
  assert.equal(dateTimeInputToIso('2026-07-01T10:00', 'Europe/Berlin'), '2026-07-01T08:00:00.000Z');
  assert.equal(dateTimeInputToIso('2026-01-15T10:00', 'Europe/Berlin'), '2026-01-15T09:00:00.000Z');
  assert.equal(isoToDateTimeInput('2026-07-01T08:00:00.000Z', 'Europe/Berlin'), '2026-07-01T10:00');
  assert.equal(dateTimeInputToIso('', 'Europe/Berlin'), null);
  assert.equal(dateTimeInputToIso('2026-03-29T02:30', 'Europe/Berlin'), null);
  assert.notEqual(dateTimeInputToIso('2026-10-25T02:30', 'Europe/Berlin'), null);
});
