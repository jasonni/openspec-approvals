import Link from 'next/link';
import { getProject } from '@/lib/projects';
import { SearchClient } from './search-client';

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}): Promise<React.ReactElement> {
  const { projectId } = await searchParams;

  if (!projectId) {
    return (
      <div className="grid">
        <div className="card">
          <h1>Semantic Search</h1>
          <p className="muted">
            projectId is required. Open <Link href="/">Changes</Link> and choose a project first.
          </p>
        </div>
      </div>
    );
  }

  if (!getProject(projectId)) {
    return (
      <div className="grid">
        <div className="card">
          <h1>Project not found</h1>
          <p className="muted">
            Unknown projectId: <code>{projectId}</code>
          </p>
          <p className="muted">
            Go back to <Link href="/">dashboard</Link> and select a valid project.
          </p>
        </div>
      </div>
    );
  }

  return <SearchClient projectId={projectId} />;
}
