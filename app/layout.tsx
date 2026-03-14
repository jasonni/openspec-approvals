import type { Metadata } from 'next';
import { Suspense } from 'react';
import './globals.css';
import { TopNav } from '@/app/components/TopNav';
import { listProjects } from '@/lib/projects';

export const metadata: Metadata = {
  title: 'OpenSpec Review',
  description: 'Review OpenSpec spec documents with inline comments and approval decisions.',
};

export default function RootLayout({ children }: { children: React.ReactNode }): React.ReactElement {
  const projects = listProjects().map((project) => ({ id: project.id, name: project.name }));

  return (
    <html lang="en">
      <body>
        <Suspense
          fallback={
            <header className="topbar">
              <div className="topbar-inner">
                <span className="brand">OpenSpec Review</span>
              </div>
            </header>
          }
        >
          <TopNav projects={projects} />
        </Suspense>
        <main>{children}</main>
      </body>
    </html>
  );
}
