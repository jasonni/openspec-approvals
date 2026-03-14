import Link from 'next/link';
import { ensureProjectBootstrapped } from '@/lib/bootstrap';
import { latestDecisionByChange } from '@/lib/db';
import { getProject, listProjects } from '@/lib/projects';
import { listChanges } from '@/lib/openspec';
import { EventStatus } from '@/app/components/EventStatus';
import { DecisionBadge } from '@/app/components/DecisionBadge';

export const runtime = 'nodejs';

type ReviewStatus = 'approved' | 'changes_requested' | 'rejected' | 'open';

function getReviewStatus(decision: string | undefined): ReviewStatus {
  if (decision === 'approve') return 'approved';
  if (decision === 'request_changes') return 'changes_requested';
  if (decision === 'reject') return 'rejected';
  return 'open';
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}): Promise<React.ReactElement> {
  const { projectId } = await searchParams;
  const projects = listProjects();

  if (!projectId) {
    return (
      <div className="landing">
        <div className="landing__hero">
          <h1 className="landing__title">OpenSpec Review</h1>
          <p className="landing__sub">Select a project to start reviewing spec documents</p>
        </div>
        <div className="project-grid">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/?projectId=${encodeURIComponent(project.id)}`}
              className="project-card"
            >
              <strong className="project-card__name">{project.name}</strong>
              <span className="project-card__id muted">{project.id}</span>
              <span className="project-card__path muted">{project.openspecRoot}</span>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  const project = getProject(projectId);
  if (!project) {
    return (
      <div className="card">
        <h2>Project not found</h2>
        <p className="muted">Unknown projectId: <code>{projectId}</code></p>
      </div>
    );
  }

  ensureProjectBootstrapped(project.id);
  const changes = listChanges(project.id);
  const latestDecisions = latestDecisionByChange(project.id);

  // Group changes by review status
  const open = changes.filter((c) => !latestDecisions[c.id]);
  const changesRequested = changes.filter((c) => latestDecisions[c.id] === 'request_changes');
  const approved = changes.filter((c) => latestDecisions[c.id] === 'approve');
  const rejected = changes.filter((c) => latestDecisions[c.id] === 'reject');

  function ChangeCard({ changeId, title, updatedAt, decision }: { changeId: string; title: string; updatedAt: string; decision?: string }): React.ReactElement {
    return (
      <div className="change-card">
        <div className="change-card__header">
          <Link href={`/review/${changeId}?projectId=${encodeURIComponent(project!.id)}`} className="change-card__title">
            {title}
          </Link>
          <DecisionBadge decision={decision as any} />
        </div>
        <p className="change-card__meta muted">
          {changeId} · updated {new Date(updatedAt).toLocaleString()}
        </p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard__header">
        <div>
          <h1 className="dashboard__title">{project.name}</h1>
          <p className="muted">{changes.length} change{changes.length !== 1 ? 's' : ''} total</p>
        </div>
        <EventStatus projectId={project.id} />
      </div>

      {/* Awaiting Review */}
      {open.length > 0 && (
        <section className="dashboard__section">
          <h2 className="dashboard__section-title">
            <span className="status-dot status-dot--open" /> Awaiting Review
            <span className="section-count">{open.length}</span>
          </h2>
          <div className="change-list">
            {open.map((c) => (
              <ChangeCard key={c.id} changeId={c.id} title={c.title} updatedAt={c.updatedAt} />
            ))}
          </div>
        </section>
      )}

      {/* Changes Requested */}
      {changesRequested.length > 0 && (
        <section className="dashboard__section">
          <h2 className="dashboard__section-title">
            <span className="status-dot status-dot--changes" /> Changes Requested
            <span className="section-count">{changesRequested.length}</span>
          </h2>
          <div className="change-list">
            {changesRequested.map((c) => (
              <ChangeCard key={c.id} changeId={c.id} title={c.title} updatedAt={c.updatedAt} decision={latestDecisions[c.id]} />
            ))}
          </div>
        </section>
      )}

      {/* Approved */}
      {approved.length > 0 && (
        <section className="dashboard__section">
          <h2 className="dashboard__section-title dashboard__section-title--muted">
            <span className="status-dot status-dot--approved" /> Approved
            <span className="section-count">{approved.length}</span>
          </h2>
          <div className="change-list change-list--muted">
            {approved.map((c) => (
              <ChangeCard key={c.id} changeId={c.id} title={c.title} updatedAt={c.updatedAt} decision={latestDecisions[c.id]} />
            ))}
          </div>
        </section>
      )}

      {/* Rejected */}
      {rejected.length > 0 && (
        <section className="dashboard__section">
          <h2 className="dashboard__section-title dashboard__section-title--muted">
            <span className="status-dot status-dot--rejected" /> Rejected
            <span className="section-count">{rejected.length}</span>
          </h2>
          <div className="change-list change-list--muted">
            {rejected.map((c) => (
              <ChangeCard key={c.id} changeId={c.id} title={c.title} updatedAt={c.updatedAt} decision={latestDecisions[c.id]} />
            ))}
          </div>
        </section>
      )}

      {changes.length === 0 && (
        <div className="card">
          <p className="muted">No changes found. Add folders under <code>{project.openspecRoot}/changes/</code>.</p>
        </div>
      )}
    </div>
  );
}
