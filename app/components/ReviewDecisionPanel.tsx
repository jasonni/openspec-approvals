'use client';

import { useEffect, useState } from 'react';
import type { ReviewSession } from '@/lib/types';

interface Props {
  projectId: string;
  changeId: string;
  author: string;
  commentCount: number;
}

export function ReviewDecisionPanel({ projectId, changeId, author, commentCount }: Props): React.ReactElement {
  const [session, setSession] = useState<ReviewSession | null>(null);
  const [decision, setDecision] = useState<string>('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState('');

  // Load or create draft session
  useEffect(() => {
    fetch('/api/review-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, changeId, reviewer: author }),
    })
      .then((r) => r.json())
      .then((d: { session: ReviewSession }) => {
        setSession(d.session);
        setDecision(d.session.decision ?? '');
        setBody(d.session.body ?? '');
        if (d.session.status === 'submitted') setSubmitted(true);
      })
      .catch(() => {});
  }, [projectId, changeId, author]);

  async function save(): Promise<void> {
    if (!session) return;
    setSaving(true);
    await fetch(`/api/review-sessions/${session.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save', sessionBody: body, decision: decision || null }),
    });
    setSaving(false);
  }

  async function submit(): Promise<void> {
    if (!session || !decision) return;
    setSaving(true);
    await fetch(`/api/review-sessions/${session.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'submit',
        sessionBody: body,
        decision,
        projectId,
        changeId,
        reviewer: author,
      }),
    });
    setSaving(false);
    setSubmitted(true);
    setMessage(`Review submitted (${decision.replace('_', ' ')})`);
  }

  if (submitted) {
    return (
      <div className="review-decision review-decision--submitted">
        <p className="review-decision__done">
          ✓ Review submitted
        </p>
        {message && <p className="muted">{message}</p>}
      </div>
    );
  }

  return (
    <div className="review-decision">
      <h4 className="review-decision__title">Submit Review</h4>
      <p className="muted review-decision__hint">
        {commentCount > 0 ? `${commentCount} comment${commentCount !== 1 ? 's' : ''} added` : 'Select text to add inline comments'}
      </p>

      <textarea
        className="review-decision__textarea"
        placeholder="Overall review comment (optional)…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onBlur={() => void save()}
        rows={3}
      />

      <div className="review-decision__decisions">
        {(['approve', 'request_changes', 'reject'] as const).map((d) => (
          <button
            key={d}
            className={`review-decision__btn review-decision__btn--${d}${decision === d ? ' active' : ''}`}
            onClick={() => { setDecision(d); }}
          >
            {d === 'approve' ? '✓ Approve' : d === 'request_changes' ? '⟳ Request Changes' : '✗ Reject'}
          </button>
        ))}
      </div>

      <button
        className="review-decision__submit"
        onClick={() => void submit()}
        disabled={saving || !decision}
      >
        {saving ? 'Submitting…' : 'Submit Review'}
      </button>
    </div>
  );
}
