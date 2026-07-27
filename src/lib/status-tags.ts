/**
 * Reserved STATUS tags — a fixed, project-management set that lives on top of
 * the free-form tag system (metadata.tags). Because a status is just a reserved
 * tag string, the existing "Filter by tag" control filters by status for free,
 * and status renders as a colored badge like any other tag.
 *
 * Two things make status special vs. free-form tags:
 *  1. Fixed labels + fixed colors (defined here, not hashed) so the meaning and
 *     color are consistent across every outline.
 *  2. Mutual exclusivity — a node has AT MOST ONE status at a time. Setting a
 *     new status replaces any existing one (see applyStatusToTags).
 */

export interface StatusTagDef {
  /** The tag string actually stored in node.metadata.tags. */
  label: string;
  /** TagBadge color classes (light + dark). Fixed per status. */
  colorClass: string;
  /** Small solid dot used in the context menu to preview the color. */
  dotClass: string;
}

export const STATUS_TAGS: StatusTagDef[] = [
  {
    label: 'Not started',
    colorClass:
      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    dotClass: 'bg-red-500',
  },
  {
    label: 'In progress',
    colorClass:
      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    dotClass: 'bg-amber-500',
  },
  {
    label: 'Done',
    colorClass:
      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    dotClass: 'bg-green-500',
  },
  {
    label: 'Blocked',
    colorClass:
      'bg-slate-200 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300',
    dotClass: 'bg-slate-500',
  },
];

/** All reserved status labels, in display order. */
export const STATUS_LABELS: string[] = STATUS_TAGS.map((s) => s.label);

/**
 * The reserved "Done" status label. A task counts as complete for
 * dependency/blocked calculations when it carries this status. Kept as a named
 * constant so the prerequisites logic never hard-codes the string.
 */
export const DONE_STATUS_LABEL = 'Done';

/** True when a tag string is one of the reserved statuses. */
export function isStatusTag(tag: string): boolean {
  return STATUS_LABELS.includes(tag);
}

/** Fixed color classes for a status tag, or null if the tag is free-form. */
export function getStatusTagColor(tag: string): string | null {
  return STATUS_TAGS.find((s) => s.label === tag)?.colorClass ?? null;
}

/**
 * Produce the new tag list for a node when its status changes.
 *
 * Strips ALL existing status tags (enforcing mutual exclusivity within the
 * status group) while preserving every free-form tag untouched. If `status`
 * is a label, it's placed FIRST so the status badge renders ahead of the
 * (up to three) shown badges. If `status` is null, the status is simply
 * cleared and only free-form tags remain.
 */
export function applyStatusToTags(
  existingTags: string[] | undefined,
  status: string | null
): string[] {
  const nonStatus = (existingTags || []).filter((t) => !isStatusTag(t));
  return status ? [status, ...nonStatus] : nonStatus;
}
