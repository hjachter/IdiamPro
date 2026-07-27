/**
 * TASK metatags — the structured, project-management fields that live on a
 * Task node's metadata. Priority is the first purely-scalar metatag (Status is
 * a reserved tag, Prerequisites is relational). Like STATUS_TAGS, each priority
 * has a fixed label + fixed colors so the meaning and color are consistent
 * across every outline, and it renders as a colored badge.
 *
 * Priority is stored as `node.metadata.priority` (a typed 'Low' | 'Medium' |
 * 'High' string), NOT as a free-form tag, so AI can read and compare it
 * directly. Optional + backward-compatible: a node with no priority simply
 * omits the key.
 */

import type { TaskPriority } from '@/types';

export interface PriorityDef {
  /** The value stored in node.metadata.priority. */
  label: TaskPriority;
  /** Badge color classes (light + dark). Fixed per level. */
  colorClass: string;
  /** Small solid dot used to preview the color. */
  dotClass: string;
}

export const TASK_PRIORITIES: PriorityDef[] = [
  {
    label: 'Low',
    colorClass:
      'bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300',
    dotClass: 'bg-slate-500',
  },
  {
    label: 'Medium',
    colorClass:
      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    dotClass: 'bg-amber-500',
  },
  {
    label: 'High',
    colorClass:
      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    dotClass: 'bg-red-500',
  },
];

/** All priority labels, in display order (Low → High). */
export const PRIORITY_LABELS: TaskPriority[] = TASK_PRIORITIES.map((p) => p.label);

/** Fixed color classes for a priority level, or null if unknown. */
export function getPriorityColor(priority: string | undefined): string | null {
  return TASK_PRIORITIES.find((p) => p.label === priority)?.colorClass ?? null;
}
