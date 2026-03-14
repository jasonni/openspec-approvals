import { cookies } from 'next/headers';
import { ensureProjectBootstrapped } from '@/lib/bootstrap';
import { countOpenCommentsByArtifact, listInlineComments } from '@/lib/db';
import { getChangeDetail } from '@/lib/openspec';
import { getProject } from '@/lib/projects';
import { resolveSpecDocumentView } from '@/lib/spec-docs';
import { ReviewClient } from './ReviewClient';

export const runtime = 'nodejs';

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ changeId: string }>;
  searchParams: Promise<{ projectId?: string; doc?: string; author?: string }>;
}): Promise<React.ReactElement> {
  const { changeId } = await params;
  const { projectId, doc, author: authorParam } = await searchParams;

  if (!projectId) {
    return (
      <div className="card">
        <h2>projectId is required</h2>
        <p className="muted">Open a project from the dashboard first.</p>
      </div>
    );
  }

  const project = getProject(projectId);
  if (!project) {
    return (
      <div className="card">
        <h2>Project not found</h2>
      </div>
    );
  }

  ensureProjectBootstrapped(project.id);
  const detail = getChangeDetail(project.id, changeId);
  if (!detail) {
    return (
      <div className="card">
        <h2>Change not found</h2>
      </div>
    );
  }

  const { activeView, availableViews } = resolveSpecDocumentView(detail.artifacts, doc);
  const commentCounts = countOpenCommentsByArtifact(project.id, changeId);
  const initialComments = listInlineComments(project.id, changeId);

  // Author identity: query param > cookie > default
  const author = authorParam ?? 'reviewer';

  return (
    <ReviewClient
      projectId={project.id}
      changeId={changeId}
      changeTitle={detail.title}
      artifacts={detail.artifacts}
      initialActiveView={activeView}
      commentCounts={commentCounts}
      author={author}
      initialComments={initialComments}
    />
  );
}
