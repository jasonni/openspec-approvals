import Link from 'next/link';
import Markdown from 'react-markdown';
import { ensureBootstrapped } from '@/lib/bootstrap';
import { getChangeDetail } from '@/lib/openspec';
import { listApprovals } from '@/lib/db';
import { DecisionBadge } from '@/app/components/DecisionBadge';
import { ApprovalForm } from './review-form';

export const runtime = 'nodejs';

export default async function ChangeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}): Promise<React.ReactElement> {
  ensureBootstrapped();
  const { id } = await params;
  const { tab } = await searchParams;

  const detail = getChangeDetail(id);
  if (!detail) {
    return (
      <div className="card">
        <h2>Change not found</h2>
        <Link href="/">Back</Link>
      </div>
    );
  }

  const approvals = listApprovals(id);
  const activeType = (tab as 'proposal' | 'design' | 'tasks' | 'spec' | undefined) ?? 'proposal';
  const activeArtifact = detail.artifacts.find((a) => a.type === activeType) ?? detail.artifacts[0];
  const latest = approvals[0];

  return (
    <div className="grid">
      <div className="card">
        <Link href="/">← Back</Link>
        <h1>{detail.title}</h1>
        <p className="muted">
          {detail.id} • {detail.artifactCount} artifacts • updated {new Date(detail.updatedAt).toLocaleString()}
        </p>
        <DecisionBadge decision={latest?.decision} />
      </div>

      <div className="card">
        <div className="tabs">
          {detail.artifacts.map((artifact) => (
            <Link
              key={`${artifact.type}:${artifact.path}`}
              className={`tab ${artifact.type === activeArtifact?.type ? 'active' : ''}`}
              href={`/changes/${id}?tab=${artifact.type}`}
            >
              {artifact.type}
            </Link>
          ))}
        </div>
        {activeArtifact ? <Markdown>{activeArtifact.content}</Markdown> : <p>No artifact.</p>}
      </div>

      <div className="card">
        <h3>Submit Review</h3>
        <ApprovalForm changeId={id} artifactType={activeArtifact?.type ?? 'proposal'} />
      </div>

      <div className="card">
        <h3>Approval Timeline</h3>
        <div className="grid">
          {approvals.length === 0 ? <p className="muted">No approvals yet.</p> : null}
          {approvals.map((approval) => (
            <div key={approval.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <DecisionBadge decision={approval.decision} />
                <span className="muted">{new Date(approval.createdAt).toLocaleString()}</span>
              </div>
              <p className="muted">
                artifact: {approval.artifactType} • reviewer: {approval.reviewer} • sync: {approval.syncStatus}
              </p>
              {approval.comment ? <p>{approval.comment}</p> : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
