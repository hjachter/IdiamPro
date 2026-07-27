/**
 * PROJECT-MANAGEMENT REPORT WIZARDS — PURE LOGIC, ZERO AI.
 *
 * These read-only "reports" present the project-management metatags the user
 * has already set (status tags, prerequisites, Task priority / due date) as a
 * tidy summary. They make NO AI calls — no cost, no pipeline — and they NEVER
 * modify a task. Each report simply reads the current outline's NodeMap and
 * returns a title + a markdown summary body that the caller drops into a new
 * outline note. All the underlying computation is reused from the existing
 * status-tags / prerequisites helpers so the numbers always agree with the
 * badges shown on the nodes themselves.
 *
 * Gated behind the Project Management capability at the UI layer (the report
 * cards only appear when PM is on); this module is capability-agnostic pure
 * data so it is trivially unit-testable.
 */

import type { NodeMap, OutlineNode } from '@/types';
import { STATUS_LABELS, isStatusTag, DONE_STATUS_LABEL } from './status-tags';
import { getBlockingPrerequisites, getPrerequisiteIds } from './prerequisites';

/** The five report ids, matched by the wizard registry + the launcher. */
export type PmReportId =
  | 'blocking'
  | 'in-progress'
  | 'waiting-blocked'
  | 'completed'
  | 'overview';

/** Static card metadata for each report — mirrors the ApplicationRecipe shape. */
export interface PmReportDef {
  id: PmReportId;
  title: string;
  subtitle: string;
  emoji: string;
  /** Tailwind gradient classes for the gallery card. */
  accent: string;
}

export const PM_REPORTS: PmReportDef[] = [
  {
    id: 'blocking',
    title: "What's Blocking Me",
    subtitle: 'Tasks stuck behind an unfinished prerequisite.',
    emoji: '🚧',
    accent: 'from-red-500 to-orange-500',
  },
  {
    id: 'in-progress',
    title: 'In Progress',
    subtitle: 'Everything currently marked In progress.',
    emoji: '🏃',
    accent: 'from-amber-500 to-yellow-500',
  },
  {
    id: 'waiting-blocked',
    title: 'Waiting / Blocked',
    subtitle: 'Not started, or blocked by a prerequisite.',
    emoji: '⏳',
    accent: 'from-slate-500 to-slate-600',
  },
  {
    id: 'completed',
    title: 'Completed',
    subtitle: 'Everything marked Done.',
    emoji: '✅',
    accent: 'from-green-500 to-emerald-500',
  },
  {
    id: 'overview',
    title: 'Status Overview',
    subtitle: 'Counts by status and percent complete.',
    emoji: '📊',
    accent: 'from-blue-500 to-indigo-500',
  },
];

/** Look up a report definition by id. */
export function getPmReport(id: PmReportId): PmReportDef | undefined {
  return PM_REPORTS.find((r) => r.id === id);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** The reserved status currently on a node, or null if none / it's free-form. */
function statusOf(node: OutlineNode): string | null {
  return node.metadata?.tags?.find(isStatusTag) ?? null;
}

/**
 * A node "participates in project management" — and therefore counts as a task
 * for these reports — when it is a Task node, carries a reserved status, or has
 * at least one prerequisite. The root is never a task. This keeps plain notes
 * out of the reports while catching every node the user has actually tracked.
 */
function isPmTask(node: OutlineNode): boolean {
  if (node.type === 'root') return false;
  if (node.type === 'task') return true;
  if (statusOf(node)) return true;
  if (getPrerequisiteIds(node).length > 0) return true;
  return false;
}

/** All task-like nodes in the outline, in a stable insertion order. */
function collectTasks(nodes: NodeMap): OutlineNode[] {
  return Object.values(nodes).filter(isPmTask);
}

/** A readable node name, never blank. */
function nameOf(node: OutlineNode): string {
  const n = (node.name || '').trim();
  return n.length > 0 ? n : '(untitled)';
}

/** Optional " · High priority · due Mar 3" suffix built from task metatags. */
function metaSuffix(node: OutlineNode): string {
  const bits: string[] = [];
  const priority = node.metadata?.priority;
  if (priority) bits.push(`${priority} priority`);
  const due = node.metadata?.dueDate;
  if (typeof due === 'number' && !Number.isNaN(due)) {
    bits.push(`due ${new Date(due).toLocaleDateString()}`);
  }
  return bits.length ? ` · ${bits.join(' · ')}` : '';
}

/** One markdown bullet line for a task, showing its status when it has one. */
function taskLine(node: OutlineNode): string {
  const status = statusOf(node);
  const statusTag = status ? ` [${status}]` : '';
  return `- ${nameOf(node)}${statusTag}${metaSuffix(node)}`;
}

/** The empty-state body shared by the list reports. */
function emptyBody(message: string): string {
  return `${message}\n\n_This is a read-only snapshot generated from your task statuses and dependencies — nothing was changed._`;
}

// ── The report builders ──────────────────────────────────────────────────────

export interface PmReportResult {
  /** Node title, e.g. "What's Blocking Me — Mar 3, 2026". */
  title: string;
  /** Markdown body for the note's content. */
  body: string;
}

/**
 * Build a report. Pure function: reads `nodes`, returns text. Never mutates,
 * never calls out. The caller inserts the result as a new outline note.
 */
export function buildPmReport(nodes: NodeMap, id: PmReportId): PmReportResult {
  const def = getPmReport(id);
  const dateLabel = new Date().toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const title = `${def ? def.title : 'Report'} — ${dateLabel}`;
  const tasks = collectTasks(nodes);

  switch (id) {
    case 'blocking': {
      // Tasks with at least one prerequisite whose status isn't Done, plus the
      // specific prerequisite(s) blocking each one.
      const rows = tasks
        .map((node) => ({ node, blockers: getBlockingPrerequisites(nodes, node.id) }))
        .filter((r) => r.blockers.length > 0);
      if (rows.length === 0) {
        return { title, body: emptyBody('Nothing is blocked right now. Every tracked task with dependencies has its prerequisites Done. 🎉') };
      }
      const lines = rows.map(({ node, blockers }) => {
        const blockerNames = blockers
          .map((b) => `${nameOf(b)}${statusOf(b) ? ` [${statusOf(b)}]` : ' [no status]'}`)
          .join(', ');
        return `- **${nameOf(node)}**${metaSuffix(node)}\n  - blocked by: ${blockerNames}`;
      });
      return {
        title,
        body: `**${rows.length}** task${rows.length === 1 ? '' : 's'} blocked by an unfinished prerequisite:\n\n${lines.join('\n')}`,
      };
    }

    case 'in-progress': {
      const rows = tasks.filter((n) => statusOf(n) === 'In progress');
      if (rows.length === 0) return { title, body: emptyBody('Nothing is marked In progress right now.') };
      return { title, body: `**${rows.length}** task${rows.length === 1 ? '' : 's'} In progress:\n\n${rows.map(taskLine).join('\n')}` };
    }

    case 'waiting-blocked': {
      // Blocked (unfinished prerequisites), the stored "Blocked" status, or Not
      // started. De-duplicated so a task that is both blocked and Not started
      // shows once.
      const rows = tasks.filter((n) => {
        const status = statusOf(n);
        const isBlocked = getBlockingPrerequisites(nodes, n.id).length > 0;
        return isBlocked || status === 'Blocked' || status === 'Not started';
      });
      if (rows.length === 0) return { title, body: emptyBody('Nothing is waiting or blocked — everything tracked is either underway or done.') };
      const lines = rows.map((node) => {
        const blockers = getBlockingPrerequisites(nodes, node.id);
        const suffix = blockers.length
          ? `\n  - blocked by: ${blockers.map((b) => nameOf(b)).join(', ')}`
          : '';
        return `${taskLine(node)}${suffix}`;
      });
      return { title, body: `**${rows.length}** task${rows.length === 1 ? '' : 's'} waiting or blocked:\n\n${lines.join('\n')}` };
    }

    case 'completed': {
      const rows = tasks.filter((n) => statusOf(n) === DONE_STATUS_LABEL);
      if (rows.length === 0) return { title, body: emptyBody('Nothing is marked Done yet.') };
      return { title, body: `**${rows.length}** task${rows.length === 1 ? '' : 's'} completed:\n\n${rows.map(taskLine).join('\n')}` };
    }

    case 'overview': {
      const total = tasks.length;
      if (total === 0) {
        return { title, body: emptyBody('No tracked tasks yet. Mark a node with a status or give it a prerequisite and it will show up here.') };
      }
      // Count per reserved status, plus "No status" and the computed Blocked set.
      const counts: Record<string, number> = {};
      for (const label of STATUS_LABELS) counts[label] = 0;
      let noStatus = 0;
      let blockedCount = 0;
      const doneNodes: OutlineNode[] = [];
      for (const node of tasks) {
        const status = statusOf(node);
        if (status) counts[status] = (counts[status] ?? 0) + 1;
        else noStatus += 1;
        if (status === DONE_STATUS_LABEL) doneNodes.push(node);
        if (getBlockingPrerequisites(nodes, node.id).length > 0) blockedCount += 1;
      }
      const done = counts[DONE_STATUS_LABEL] ?? 0;
      const pct = Math.round((done / total) * 100);
      const barLen = 20;
      const filled = Math.round((pct / 100) * barLen);
      const bar = '█'.repeat(filled) + '░'.repeat(barLen - filled);

      const statusLines = STATUS_LABELS.map((label) => `- ${label}: ${counts[label] ?? 0}`);
      if (noStatus > 0) statusLines.push(`- No status: ${noStatus}`);

      const body = [
        `**${pct}% complete** — ${done} of ${total} tracked task${total === 1 ? '' : 's'} Done.`,
        '',
        `\`${bar}\`  ${pct}%`,
        '',
        '**By status**',
        ...statusLines,
        '',
        `**Blocked by a prerequisite:** ${blockedCount}`,
        '',
        '_Read-only snapshot generated from your task statuses and dependencies — nothing was changed._',
      ].join('\n');
      return { title, body };
    }

    default:
      return { title, body: emptyBody('Unknown report.') };
  }
}
