import type { TaskSection, TaskTreeNode } from '@/lib/types';

type RawTask = {
  id: string;
  title: string;
  done: boolean;
};

type RawSection = {
  id: string;
  title: string;
  tasks: RawTask[];
};

const SECTION_RE = /^##\s+(.+?)\s*$/;
const SECTION_ID_RE = /^(\d+(?:\.\d+)*)\.?\s*(.+)?$/;
const TASK_RE = /^\s*-\s*\[( |x|X)\]\s+((?:\d+\.)*\d+)\s+(.*)$/;

function progress(total: number, completed: number): { total: number; completed: number; completionPercentage: number } {
  return {
    total,
    completed,
    completionPercentage: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}

function taskDepth(taskId: string): number {
  return Math.max(0, taskId.split('.').length - 1);
}

function parseSectionHeader(rawTitle: string, fallbackIndex: number): { id: string; title: string } {
  const normalized = rawTitle.trim();
  const match = normalized.match(SECTION_ID_RE);
  if (!match) {
    return { id: `section-${fallbackIndex}`, title: normalized };
  }

  const [, id, title] = match;
  return {
    id,
    title: (title ?? '').trim() || normalized,
  };
}

function buildHierarchy(tasks: RawTask[]): TaskTreeNode[] {
  const nodes = tasks.map<TaskTreeNode>((task) => ({
    id: task.id,
    title: task.title,
    done: task.done,
    depth: taskDepth(task.id),
    children: [],
    ...progress(1, task.done ? 1 : 0),
  }));

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const roots: TaskTreeNode[] = [];

  for (const node of nodes) {
    const parts = node.id.split('.');
    let parent: TaskTreeNode | undefined;
    while (parts.length > 1) {
      parts.pop();
      const parentId = parts.join('.');
      const found = byId.get(parentId);
      if (found) {
        parent = found;
        break;
      }
    }

    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const applyProgress = (node: TaskTreeNode): TaskTreeNode => {
    if (node.children.length === 0) return node;
    let total = 1;
    let completed = node.done ? 1 : 0;
    const computedChildren = node.children.map((child) => applyProgress(child));
    for (const child of computedChildren) {
      total += child.total;
      completed += child.completed;
    }
    node.children = computedChildren;
    Object.assign(node, progress(total, completed));
    return node;
  };

  return roots.map((node) => applyProgress(node));
}

function sectionWithProgress(section: RawSection): TaskSection {
  const tree = buildHierarchy(section.tasks);
  const totals = tree.reduce(
    (acc, node) => {
      acc.total += node.total;
      acc.completed += node.completed;
      return acc;
    },
    { total: 0, completed: 0 }
  );

  return {
    id: section.id,
    title: section.title,
    tasks: tree,
    ...progress(totals.total, totals.completed),
  };
}

export function parseTaskSections(markdown: string): TaskSection[] {
  const lines = markdown.split('\n');
  const sections: RawSection[] = [];
  let currentSection: RawSection | null = null;

  for (const line of lines) {
    const sectionMatch = line.match(SECTION_RE);
    if (sectionMatch) {
      const parsed = parseSectionHeader(sectionMatch[1], sections.length + 1);
      currentSection = { id: parsed.id, title: parsed.title, tasks: [] };
      sections.push(currentSection);
      continue;
    }

    const taskMatch = line.match(TASK_RE);
    if (!taskMatch) continue;

    if (!currentSection) {
      currentSection = { id: 'section-0', title: 'Tasks', tasks: [] };
      sections.push(currentSection);
    }

    currentSection.tasks.push({
      done: taskMatch[1].toLowerCase() === 'x',
      id: taskMatch[2].replace(/\.$/, ''),
      title: taskMatch[3].trim(),
    });
  }

  return sections.map((section) => sectionWithProgress(section));
}

export function collectTaskProgress(sections: TaskSection[]): { total: number; completed: number; completionPercentage: number } {
  const totals = sections.reduce(
    (acc, section) => {
      acc.total += section.total;
      acc.completed += section.completed;
      return acc;
    },
    { total: 0, completed: 0 }
  );
  return progress(totals.total, totals.completed);
}
