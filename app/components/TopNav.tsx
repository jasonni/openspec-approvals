'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

type TopNavProject = { id: string; name: string };

export function TopNav({ projects }: { projects: TopNavProject[] }): React.ReactElement {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentProjectId = searchParams.get('projectId') ?? '';
  const defaultProjectId = projects[0]?.id ?? '';
  const activeProjectId = currentProjectId || defaultProjectId;

  const withProject = (href: '/' | '/search'): string => {
    if (!activeProjectId) return href;
    return `${href}?projectId=${encodeURIComponent(activeProjectId)}`;
  };

  const isOnReview = pathname.startsWith('/review/');

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href="/" className="brand">OpenSpec Review</Link>

        {!isOnReview && (
          <nav className="nav" aria-label="Primary navigation">
            <Link href={withProject('/')}>Changes</Link>
            <Link href={withProject('/search')}>Search</Link>
          </nav>
        )}

        <div style={{ marginLeft: 'auto' }}>
          {projects.length > 1 && (
            <select
              aria-label="Select project"
              value={currentProjectId}
              onChange={(e) => {
                const nextProjectId = e.target.value;
                const params = new URLSearchParams(searchParams.toString());
                if (nextProjectId) params.set('projectId', nextProjectId);
                else params.delete('projectId');
                const query = params.toString();
                router.push(query ? `${pathname}?${query}` : pathname);
              }}
              style={{ width: 'auto' }}
            >
              <option value="">Select project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>
    </header>
  );
}
