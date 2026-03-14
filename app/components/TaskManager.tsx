'use client';

import { useEffect, useMemo, useState } from 'react';
import { DASHBOARD_PREF_EVENT, DASHBOARD_SHOW_COMPLETED_KEY, parseShowCompleted } from '@/app/components/dashboard-preferences';
import type { TaskSection, TaskTreeNode } from '@/lib/types';

type ComputedTaskNode = Omit<TaskTreeNode, 'children'> & { children: ComputedTaskNode[] };

function pct(total: number, completed: number): number {
  return total === 0 ? 0 : Math.round((completed / total) * 100);
}

function computeNode(node: TaskTreeNode, doneById: Record<string, boolean>, showCompleted: boolean): ComputedTaskNode | null {
  const done = doneById[node.id] ?? node.done;
  const children = node.children
    .map((child) => computeNode(child, doneById, showCompleted))
    .filter((child): child is ComputedTaskNode => Boolean(child));
  const total = 1 + children.reduce((sum, child) => sum + child.total, 0);
  const completed = (done ? 1 : 0) + children.reduce((sum, child) => sum + child.completed, 0);

  if (!showCompleted && done && children.length === 0) {
    return null;
  }

  return {
    ...node,
    done,
    children,
    total,
    completed,
    completionPercentage: pct(total, completed),
  };
}

function computeSections(sections: TaskSection[], doneById: Record<string, boolean>, showCompleted: boolean): TaskSection[] {
  return sections.map((section) => {
    const tasks = section.tasks
      .map((node) => computeNode(node, doneById, showCompleted))
      .filter((node): node is ComputedTaskNode => Boolean(node));
    const total = tasks.reduce((sum, task) => sum + task.total, 0);
    const completed = tasks.reduce((sum, task) => sum + task.completed, 0);
    return {
      ...section,
      tasks,
      total,
      completed,
      completionPercentage: pct(total, completed),
    };
  });
}

function collectDoneState(sections: TaskSection[]): Record<string, boolean> {
  const doneById: Record<string, boolean> = {};
  const walk = (node: TaskTreeNode): void => {
    doneById[node.id] = node.done;
    for (const child of node.children) walk(child);
  };
  for (const section of sections) {
    for (const task of section.tasks) walk(task);
  }
  return doneById;
}

function TaskTreeItem({
  node,
  onToggle,
}: {
  node: ComputedTaskNode;
  onToggle: (taskId: string) => void;
}): React.ReactElement {
  const [copied, setCopied] = useState(false);

  return (
    <li className="task-item" style={{ marginLeft: `${node.depth * 10}px` }}>
      <div className="task-item-row">
        <label className="task-checkbox">
          <input type="checkbox" checked={node.done} onChange={() => onToggle(node.id)} aria-label={`Toggle task ${node.id}`} />
          <span>
            <code>{node.id}</code> {node.title}
          </span>
        </label>
        <div style={{ display: 'flex', gap: 6 }}>
          <span className="muted" aria-label={`Task progress ${node.completed} out of ${node.total}`}>
            {node.completed}/{node.total}
          </span>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(`${node.id} ${node.title}`);
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      {node.children.length > 0 ? (
        <ul className="task-tree">
          {node.children.map((child) => (
            <TaskTreeItem key={`${node.id}:${child.id}`} node={child} onToggle={onToggle} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function TaskManager({
  changeId,
  sections,
}: {
  changeId: string;
  sections: TaskSection[];
}): React.ReactElement {
  const [doneById, setDoneById] = useState<Record<string, boolean>>(() => collectDoneState(sections));
  const [showCompleted, setShowCompleted] = useState(true);

  useEffect(() => {
    setShowCompleted(parseShowCompleted(localStorage.getItem(DASHBOARD_SHOW_COMPLETED_KEY)));

    const onPreferenceUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ showCompleted?: boolean }>;
      if (typeof customEvent.detail?.showCompleted === 'boolean') {
        setShowCompleted(customEvent.detail.showCompleted);
      }
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === DASHBOARD_SHOW_COMPLETED_KEY) {
        setShowCompleted(parseShowCompleted(event.newValue));
      }
    };

    window.addEventListener(DASHBOARD_PREF_EVENT, onPreferenceUpdate as EventListener);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(DASHBOARD_PREF_EVENT, onPreferenceUpdate as EventListener);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const computedSections = useMemo(
    () => computeSections(sections, doneById, showCompleted),
    [sections, doneById, showCompleted]
  );

  return (
    <div className="grid" aria-label={`Task manager for ${changeId}`}>
      {computedSections.length === 0 ? <p className="muted">No structured tasks found.</p> : null}
      {computedSections.map((section) => (
        <div key={`${changeId}:${section.id}`} className="task-section">
          <div className="task-section-head">
            <h4 style={{ margin: 0 }}>
              {section.id} {section.title}
            </h4>
            <span className="muted">
              {section.completed}/{section.total} • {section.completionPercentage}%
            </span>
          </div>
          <div className="progress-track" aria-label={`Section ${section.id} progress`}>
            <div className="progress-fill" style={{ width: `${section.completionPercentage}%` }} />
          </div>
          <ul className="task-tree">
            {section.tasks.map((task) => (
              <TaskTreeItem
                key={`${changeId}:${section.id}:${task.id}`}
                node={task}
                onToggle={(taskId) => {
                  setDoneById((previous) => ({ ...previous, [taskId]: !previous[taskId] }));
                }}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
