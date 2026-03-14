'use client';

import { useEffect, useRef, useState } from 'react';
import type { InlineComment, ReviewSession } from '@/lib/types';

interface Props {
  projectId: string;
  changeId: string;
  artifactType: string;
  author: string;
  refreshKey: number;
  onScrollTo?: (paragraphId: string) => void;
}

function timeSince(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function CommentPanel({ projectId, changeId, artifactType, author, refreshKey, onScrollTo }: Props): React.ReactElement {
  const [comments, setComments] = useState<InlineComment[]>([]);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/comments?projectId=${encodeURIComponent(projectId)}&changeId=${encodeURIComponent(changeId)}&artifactType=${encodeURIComponent(artifactType)}`)
      .then((r) => r.json())
      .then((d: { comments: InlineComment[] }) => setComments(d.comments))
      .catch(() => {});
  }, [projectId, changeId, artifactType, refreshKey]);

  // Build threads: group replies under root comments
  const roots = comments.filter((c) => !c.parentId);
  const repliesByParent = comments.reduce<Record<string, InlineComment[]>>((acc, c) => {
    if (c.parentId) {
      if (!acc[c.parentId]) acc[c.parentId] = [];
      acc[c.parentId].push(c);
    }
    return acc;
  }, {});

  async function resolve(id: string): Promise<void> {
    await fetch(`/api/comments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'resolve', resolvedBy: author }),
    });
    setComments((prev) => prev.map((c) => c.id === id ? { ...c, status: 'resolved' } : c));
  }

  async function reopen(id: string): Promise<void> {
    await fetch(`/api/comments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reopen' }),
    });
    setComments((prev) => prev.map((c) => c.id === id ? { ...c, status: 'open' } : c));
  }

  async function submitReply(parentId: string): Promise<void> {
    if (!replyBody.trim()) return;
    setSaving(true);
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        changeId,
        artifactType,
        paragraphId: comments.find((c) => c.id === parentId)?.paragraphId ?? 'doc',
        selectedText: '',
        author,
        body: replyBody.trim(),
        parentId,
      }),
    });
    const data = (await res.json()) as { comments: InlineComment[] };
    setComments(data.comments);
    setReplyingTo(null);
    setReplyBody('');
    setSaving(false);
  }

  if (roots.length === 0) {
    return (
      <div className="comment-panel__empty">
        <p>No comments yet.</p>
        <p className="muted">Select any text in the document to add a comment.</p>
      </div>
    );
  }

  return (
    <div className="comment-panel">
      {roots.map((root) => {
        const replies = repliesByParent[root.id] ?? [];
        return (
          <div key={root.id} className={`comment-thread${root.status === 'resolved' ? ' comment-thread--resolved' : ''}`}>
            {/* Root comment */}
            <div className="comment-item">
              <div className="comment-item__meta">
                <span className="comment-item__author">{root.author}</span>
                <span className="comment-item__time">{timeSince(root.createdAt)}</span>
                {root.status === 'resolved' && <span className="comment-item__resolved-badge">Resolved</span>}
              </div>
              {root.selectedText && (
                <button
                  className="comment-item__quote"
                  onClick={() => onScrollTo?.(root.paragraphId)}
                  title="Jump to paragraph"
                >
                  "{root.selectedText.slice(0, 80)}{root.selectedText.length > 80 ? '…' : ''}"
                </button>
              )}
              <p className="comment-item__body">{root.body}</p>
              <div className="comment-item__actions">
                <button className="link-btn" onClick={() => { setReplyingTo(root.id); setReplyBody(''); }}>Reply</button>
                {root.status === 'open'
                  ? <button className="link-btn" onClick={() => void resolve(root.id)}>Resolve</button>
                  : <button className="link-btn" onClick={() => void reopen(root.id)}>Reopen</button>
                }
              </div>
            </div>

            {/* Replies */}
            {replies.map((reply) => (
              <div key={reply.id} className="comment-item comment-item--reply">
                <div className="comment-item__meta">
                  <span className="comment-item__author">{reply.author}</span>
                  <span className="comment-item__time">{timeSince(reply.createdAt)}</span>
                </div>
                <p className="comment-item__body">{reply.body}</p>
              </div>
            ))}

            {/* Reply form */}
            {replyingTo === root.id && (
              <div className="comment-reply-form">
                <textarea
                  className="comment-reply-form__textarea"
                  placeholder="Write a reply…"
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  rows={2}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submitReply(root.id);
                    if (e.key === 'Escape') setReplyingTo(null);
                  }}
                />
                <div className="comment-item__actions">
                  <button className="link-btn" onClick={() => setReplyingTo(null)}>Cancel</button>
                  <button className="primary" onClick={() => void submitReply(root.id)} disabled={saving || !replyBody.trim()}>
                    {saving ? 'Saving…' : 'Reply'}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
