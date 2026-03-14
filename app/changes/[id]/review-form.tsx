'use client';

import { useState } from 'react';

export function ApprovalForm({
  projectId,
  changeId,
  artifactType,
}: {
  projectId: string;
  changeId: string;
  artifactType: 'proposal' | 'design' | 'tasks' | 'spec';
}): React.ReactElement {
  const [decision, setDecision] = useState<'approve' | 'request_changes' | 'reject'>('approve');
  const [comment, setComment] = useState('');
  const [reviewer, setReviewer] = useState('local-reviewer');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(): Promise<void> {
    setSaving(true);
    setMessage('');
    const res = await fetch('/api/approvals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, changeId, artifactType, decision, comment, reviewer }),
    });

    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setMessage(data.error ?? 'Failed to submit approval.');
      setSaving(false);
      return;
    }

    setMessage('Approval submitted. Refresh to see the latest timeline.');
    setSaving(false);
  }

  return (
    <div className="grid">
      <label>
        Decision
        <select value={decision} onChange={(e) => setDecision(e.target.value as 'approve' | 'request_changes' | 'reject')}>
          <option value="approve">approve</option>
          <option value="request_changes">request_changes</option>
          <option value="reject">reject</option>
        </select>
      </label>

      <label>
        Reviewer
        <input value={reviewer} onChange={(e) => setReviewer(e.target.value)} />
      </label>

      <label>
        Comment
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={4} />
      </label>

      <button className="primary" onClick={submit} disabled={saving}>
        {saving ? 'Submitting...' : 'Submit'}
      </button>
      {message ? <p className="muted">{message}</p> : null}
    </div>
  );
}
