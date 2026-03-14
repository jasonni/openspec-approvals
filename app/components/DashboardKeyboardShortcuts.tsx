'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

function canHandleShortcut(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return true;
  const tag = target.tagName.toLowerCase();
  if (target.isContentEditable) return false;
  return !['input', 'textarea', 'select', 'button'].includes(tag);
}

function focusSection(id: string): void {
  const element = document.getElementById(id);
  if (!element) return;
  element.focus({ preventScroll: false });
}

export function DashboardKeyboardShortcuts({ projectId }: { projectId: string }): React.ReactElement {
  const router = useRouter();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!canHandleShortcut(event.target)) return;

      if (event.altKey && event.key === '1') {
        event.preventDefault();
        focusSection('dashboard-overview');
        return;
      }

      if (event.altKey && event.key === '2') {
        event.preventDefault();
        focusSection('changes-list');
        return;
      }

      if (event.altKey && event.key === '3') {
        event.preventDefault();
        focusSection('recent-activity');
        return;
      }

      if (!event.altKey && !event.metaKey && !event.ctrlKey && event.key === '/') {
        event.preventDefault();
        router.push(`/search?projectId=${encodeURIComponent(projectId)}`);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [projectId, router]);

  return (
    <p className="muted shortcut-hints" role="note">
      Shortcuts: <kbd>Alt+1</kbd> overview, <kbd>Alt+2</kbd> change list, <kbd>Alt+3</kbd> recent activity,{' '}
      <kbd>/</kbd> search.
    </p>
  );
}
