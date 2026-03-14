import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSpecDocumentView } from '../lib/spec-docs';
import type { Artifact } from '../lib/types';

const base = {
  path: '/tmp/file.md',
  content: '# demo',
  headings: ['demo'],
};

test('falls back to first available doc view when requested doc is invalid', () => {
  const artifacts: Artifact[] = [
    { ...base, type: 'design' },
    { ...base, type: 'tasks' },
  ];
  const resolved = resolveSpecDocumentView(artifacts, 'unknown');
  assert.equal(resolved.activeView, 'design');
  assert.deepEqual(resolved.availableViews, ['design', 'tasks']);
  assert.equal(resolved.activeArtifact?.type, 'design');
});

test('requirements view resolves to spec artifact when available', () => {
  const artifacts: Artifact[] = [
    { ...base, type: 'spec' },
    { ...base, type: 'proposal' },
  ];
  const resolved = resolveSpecDocumentView(artifacts, 'requirements');
  assert.equal(resolved.activeView, 'requirements');
  assert.equal(resolved.activeArtifact?.type, 'spec');
});

test('requirements view falls back to proposal when spec is missing', () => {
  const artifacts: Artifact[] = [{ ...base, type: 'proposal' }];
  const resolved = resolveSpecDocumentView(artifacts, 'requirements');
  assert.equal(resolved.activeView, 'requirements');
  assert.equal(resolved.activeArtifact?.type, 'proposal');
});
