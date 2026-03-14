'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';

interface SelectionInfo {
  paragraphId: string;
  selectedText: string;
  rect: DOMRect;
}

interface Props {
  content: string;
  artifactType: string;
  changeId: string;
  projectId: string;
  author: string;
  onCommentAdded: () => void;
  highlightedParagraphIds?: Set<string>;
}

export function DocViewer({ content, artifactType, changeId, projectId, author, onCommentAdded, highlightedParagraphIds }: Props): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<SelectionInfo | null>(null);
  const [commentBody, setCommentBody] = useState('');
  const [saving, setSaving] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Assign paragraph IDs to <p> elements after mount
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let idx = 0;
    container.querySelectorAll('p, li, blockquote').forEach((el) => {
      if (!el.id) {
        el.id = `p-${idx}`;
        idx++;
      }
    });
  }, [content]);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent): void {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setSelection(null);
        setCommentBody('');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) return;
    const selectedText = sel.toString().trim();

    // Walk up to find the nearest element with an ID
    const range = sel.getRangeAt(0);
    let el: Element | null = range.commonAncestorContainer as Element;
    if (el.nodeType === Node.TEXT_NODE) el = el.parentElement;

    // Find containing anchored element
    while (el && !el.id && el !== containerRef.current) {
      el = el.parentElement;
    }

    const paragraphId = el?.id ?? 'doc';
    const rect = range.getBoundingClientRect();
    setSelection({ paragraphId, selectedText, rect });
    setCommentBody('');
  }, []);

  async function submitComment(): Promise<void> {
    if (!selection || !commentBody.trim()) return;
    setSaving(true);
    await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        changeId,
        artifactType,
        paragraphId: selection.paragraphId,
        selectedText: selection.selectedText,
        author,
        body: commentBody.trim(),
      }),
    });
    setSaving(false);
    setSelection(null);
    setCommentBody('');
    onCommentAdded();
  }

  // Calculate popover position (viewport-relative)
  const popoverStyle: React.CSSProperties = selection
    ? {
        position: 'fixed',
        top: selection.rect.bottom + 8,
        left: Math.max(8, Math.min(selection.rect.left, window.innerWidth - 340)),
        zIndex: 1000,
        width: 320,
      }
    : { display: 'none' };

  return (
    <div style={{ position: 'relative' }} onMouseUp={handleMouseUp} ref={containerRef}>
      <div className="doc-content">
        <Markdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeSlug]}
          components={{
            h1: ({ children, ...props }) => <h1 className="doc-h1" {...props}>{children}</h1>,
            h2: ({ children, ...props }) => <h2 className="doc-h2" {...props}>{children}</h2>,
            h3: ({ children, ...props }) => <h3 className="doc-h3" {...props}>{children}</h3>,
            p: ({ children, ...props }) => {
              const id = (props as Record<string, unknown>).id as string | undefined;
              const highlighted = id && highlightedParagraphIds?.has(id);
              return (
                <p
                  className={`doc-p${highlighted ? ' doc-p--highlighted' : ''}`}
                  {...props}
                >
                  {children}
                </p>
              );
            },
            code: ({ children, className, ...props }) => {
              const isBlock = className?.startsWith('language-');
              return isBlock ? (
                <code className={`doc-code-block ${className ?? ''}`} {...props}>{children}</code>
              ) : (
                <code className="doc-code-inline" {...props}>{children}</code>
              );
            },
            pre: ({ children }) => <pre className="doc-pre">{children}</pre>,
            blockquote: ({ children, ...props }) => <blockquote className="doc-blockquote" {...props}>{children}</blockquote>,
            table: ({ children }) => <div className="doc-table-wrap"><table className="doc-table">{children}</table></div>,
            a: ({ href, children }) => <a href={href} className="doc-link" target={href?.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer">{children}</a>,
          }}
        >
          {content}
        </Markdown>
      </div>

      {/* Comment popover */}
      {selection && (
        <div ref={popoverRef} className="comment-popover" style={popoverStyle}>
          <p className="comment-popover__quote">"{selection.selectedText.slice(0, 120)}{selection.selectedText.length > 120 ? '…' : ''}"</p>
          <textarea
            className="comment-popover__textarea"
            placeholder="Add a comment…"
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
            rows={3}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submitComment();
              if (e.key === 'Escape') { setSelection(null); setCommentBody(''); }
            }}
          />
          <div className="comment-popover__actions">
            <button onClick={() => { setSelection(null); setCommentBody(''); }}>Cancel</button>
            <button className="primary" onClick={() => void submitComment()} disabled={saving || !commentBody.trim()}>
              {saving ? 'Saving…' : 'Comment'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
