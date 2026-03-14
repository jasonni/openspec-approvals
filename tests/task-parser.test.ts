import test from 'node:test';
import assert from 'node:assert/strict';
import { collectTaskProgress, parseTaskSections } from '../lib/task-parser';

test('parseTaskSections builds parent-child relationships and progress', () => {
  const markdown = `
## 1. Planning
- [x] 1.1 Define interfaces
- [ ] 1.1.1 Confirm edge cases
- [x] 1.2 Draft API
`;
  const sections = parseTaskSections(markdown);
  assert.equal(sections.length, 1);
  assert.equal(sections[0].id, '1');
  assert.equal(sections[0].tasks.length, 2);

  const parent = sections[0].tasks.find((task) => task.id === '1.1');
  assert.ok(parent);
  assert.equal(parent.children.length, 1);
  assert.equal(parent.children[0].id, '1.1.1');

  assert.equal(sections[0].total, 3);
  assert.equal(sections[0].completed, 2);
  assert.equal(sections[0].completionPercentage, 67);
});

test('collectTaskProgress aggregates all sections', () => {
  const markdown = `
## 1. Modeling
- [x] 1.1 Types
## 2. UI
- [ ] 2.1 Component
`;
  const sections = parseTaskSections(markdown);
  const summary = collectTaskProgress(sections);
  assert.deepEqual(summary, { total: 2, completed: 1, completionPercentage: 50 });
});
