import test from 'node:test';
import assert from 'node:assert/strict';
import { eventIdentity, mergeRealtimeNotifications } from '../lib/stream-events';

test('eventIdentity prefers id when present', () => {
  const key = eventIdentity({ id: 'evt-1', type: 'sync_status', message: 'hello' });
  assert.equal(key, 'evt-1');
});

test('eventIdentity falls back to type/message/createdAt', () => {
  const key = eventIdentity({ type: 'indexed', message: 'indexed', createdAt: '2026-03-11T00:00:00.000Z' });
  assert.equal(key, 'indexed:indexed:2026-03-11T00:00:00.000Z');
});

test('mergeRealtimeNotifications prepends unique events and de-duplicates', () => {
  const existing = [{ id: 'evt-1', type: 'indexed', message: 'Initial index' }];
  const duplicate = { id: 'evt-1', type: 'indexed', message: 'Initial index' };
  const unique = { id: 'evt-2', type: 'approval_created', message: 'Approval created' };

  const unchanged = mergeRealtimeNotifications(existing, duplicate, 5);
  assert.equal(unchanged.length, 1);
  assert.equal(unchanged[0].id, 'evt-1');

  const merged = mergeRealtimeNotifications(unchanged, unique, 5);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].id, 'evt-2');
  assert.equal(merged[1].id, 'evt-1');
});
