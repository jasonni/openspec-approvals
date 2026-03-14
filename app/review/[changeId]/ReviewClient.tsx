'use client';

import Link from 'next/link';
import { useCallback, useRef, useState } from 'react';
import { DocViewer } from '@/app/components/DocViewer';
import { CommentPanel } from '@/app/components/CommentPanel';
import { ReviewDecisionPanel } from '@/app/components/ReviewDecisionPanel';
import type { Artifact, InlineComment } from '@/lib/types';

interface Props {
  projectId: string;
  changeId: string;
  changeTitle: string;
  artifacts: Artifact[];
  initialActiveView: string;
  commentCounts: Record<string, number>;
  author: string;
  initialComments: InlineComment[];
}

const VIEW_LABELS: Record<string, string> = {
  proposal: 'Proposal',
  design: 'Design',
  tasks: 'Tasks',
};

// Artifact order for navigation: Proposal → Design → Specs → Tasks
const ARTIFACT_ORDER: Record<string, number> = {
  proposal: 0,
  design: 1,
  spec: 2,
  tasks: 3,
};

function getArtifactKey(artifact: Artifact): string {
  // For specs, use specId to differentiate; otherwise use type
  if (artifact.type === 'spec' && artifact.specId) {
    return `spec:${artifact.specId}`;
  }
  return artifact.type;
}

function getArtifactLabel(artifact: Artifact): string {
  if (artifact.type === 'spec' && artifact.specId) {
    // Format specId: "otp-login" -> "Otp Login"
    return artifact.specId
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  return VIEW_LABELS[artifact.type] ?? artifact.type;
}

function isSpecKey(key: string): boolean {
  return key.startsWith('spec:');
}

export function ReviewClient({
  projectId,
  changeId,
  changeTitle,
  artifacts,
  initialActiveView,
  commentCounts,
  author,
  initialComments,
}: Props): React.ReactElement {
  // Map initial view to artifact key
  const initialKey = artifacts.find((a) => {
    if (initialActiveView === 'requirements') return a.type === 'spec';
    return a.type === initialActiveView;
  });
  const [activeKey, setActiveKey] = useState(initialKey ? getArtifactKey(initialKey) : (artifacts[0] ? getArtifactKey(artifacts[0]) : ''));
  const [refreshKey, setRefreshKey] = useState(0);
  const [localCounts, setLocalCounts] = useState<Record<string, number>>(commentCounts);
  const docRef = useRef<HTMLDivElement>(null);

  // Split artifacts into specs and non-specs, sorted by order
  const specArtifacts = artifacts.filter((a) => a.type === 'spec');
  const nonSpecArtifacts = artifacts
    .filter((a) => a.type !== 'spec')
    .sort((a, b) => (ARTIFACT_ORDER[a.type] ?? 99) - (ARTIFACT_ORDER[b.type] ?? 99));
  const hasMultipleSpecs = specArtifacts.length > 1;

  // Auto-expand specs group when active item is a spec
  const [specsExpanded, setSpecsExpanded] = useState(isSpecKey(activeKey));

  const activeArtifact = artifacts.find((a) => getArtifactKey(a) === activeKey) ?? artifacts[0];
  const activeArtifactType = activeArtifact?.type ?? 'proposal';
  const totalOpenComments = Object.values(localCounts).reduce((s, v) => s + v, 0);

  // Highlighted paragraphs (those that have comments)
  const highlightedParagraphIds = new Set(
    initialComments
      .filter((c) => c.artifactType === activeArtifactType && c.status === 'open')
      .map((c) => c.paragraphId)
  );

  const handleCommentAdded = useCallback(() => {
    setRefreshKey((k) => k + 1);
    setLocalCounts((prev) => ({
      ...prev,
      [activeArtifactType]: (prev[activeArtifactType] ?? 0) + 1,
    }));
  }, [activeArtifactType]);

  function scrollToParagraph(paragraphId: string): void {
    const el = docRef.current?.querySelector(`#${CSS.escape(paragraphId)}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('doc-p--flash');
      setTimeout(() => el.classList.remove('doc-p--flash'), 1500);
    }
  }

  return (
    <div className="review-layout">
      {/* Left: Artifact Nav */}
      <aside className="artifact-nav">
        <div className="artifact-nav__back">
          <Link href={`/?projectId=${encodeURIComponent(projectId)}`}>← Back</Link>
        </div>
        <h2 className="artifact-nav__title">{changeTitle}</h2>
        <nav>
          {/* Render non-spec artifacts before specs */}
          {nonSpecArtifacts
            .filter((a) => (ARTIFACT_ORDER[a.type] ?? 99) < ARTIFACT_ORDER.spec)
            .map((artifact) => {
              const key = getArtifactKey(artifact);
              const count = localCounts[artifact.type] ?? 0;
              return (
                <button
                  key={key}
                  className={`artifact-nav__item${activeKey === key ? ' active' : ''}`}
                  onClick={() => setActiveKey(key)}
                >
                  <span className="artifact-nav__label">{getArtifactLabel(artifact)}</span>
                  {count > 0 && <span className="artifact-nav__badge">{count}</span>}
                </button>
              );
            })}

          {/* Render specs: collapsible group if multiple, flat if single */}
          {hasMultipleSpecs ? (
            <div className="artifact-nav__group">
              <button
                className={`artifact-nav__item artifact-nav__group-header${isSpecKey(activeKey) ? ' active' : ''}`}
                onClick={() => setSpecsExpanded((prev) => !prev)}
              >
                <span className="artifact-nav__expand-icon">{specsExpanded ? '▼' : '▶'}</span>
                <span className="artifact-nav__label">Specs</span>
              </button>
              {specsExpanded && (
                <div className="artifact-nav__group-items">
                  {specArtifacts.map((artifact) => {
                    const key = getArtifactKey(artifact);
                    const count = localCounts[artifact.type] ?? 0;
                    return (
                      <button
                        key={key}
                        className={`artifact-nav__item artifact-nav__item--nested${activeKey === key ? ' active' : ''}`}
                        onClick={() => setActiveKey(key)}
                      >
                        <span className="artifact-nav__label">{getArtifactLabel(artifact)}</span>
                        {count > 0 && <span className="artifact-nav__badge">{count}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            specArtifacts.map((artifact) => {
              const key = getArtifactKey(artifact);
              const count = localCounts[artifact.type] ?? 0;
              return (
                <button
                  key={key}
                  className={`artifact-nav__item${activeKey === key ? ' active' : ''}`}
                  onClick={() => setActiveKey(key)}
                >
                  <span className="artifact-nav__label">{getArtifactLabel(artifact)}</span>
                  {count > 0 && <span className="artifact-nav__badge">{count}</span>}
                </button>
              );
            })
          )}

          {/* Render non-spec artifacts after specs */}
          {nonSpecArtifacts
            .filter((a) => (ARTIFACT_ORDER[a.type] ?? 99) > ARTIFACT_ORDER.spec)
            .map((artifact) => {
              const key = getArtifactKey(artifact);
              const count = localCounts[artifact.type] ?? 0;
              return (
                <button
                  key={key}
                  className={`artifact-nav__item${activeKey === key ? ' active' : ''}`}
                  onClick={() => setActiveKey(key)}
                >
                  <span className="artifact-nav__label">{getArtifactLabel(artifact)}</span>
                  {count > 0 && <span className="artifact-nav__badge">{count}</span>}
                </button>
              );
            })}
        </nav>
      </aside>

      {/* Center: Document */}
      <div className="doc-pane" ref={docRef}>
        {activeArtifact ? (
          <DocViewer
            content={activeArtifact.content}
            artifactType={activeArtifactType}
            changeId={changeId}
            projectId={projectId}
            author={author}
            onCommentAdded={handleCommentAdded}
            highlightedParagraphIds={highlightedParagraphIds}
          />
        ) : (
          <p className="muted">No document available for this view.</p>
        )}
      </div>

      {/* Right: Review Panel */}
      <aside className="review-panel">
        <div className="review-panel__section">
          <h4 className="review-panel__section-title">Comments</h4>
          <CommentPanel
            projectId={projectId}
            changeId={changeId}
            artifactType={activeArtifactType}
            author={author}
            refreshKey={refreshKey}
            onScrollTo={scrollToParagraph}
          />
        </div>

        <div className="review-panel__section review-panel__decision-section">
          <ReviewDecisionPanel
            projectId={projectId}
            changeId={changeId}
            author={author}
            commentCount={totalOpenComments}
          />
        </div>
      </aside>
    </div>
  );
}
