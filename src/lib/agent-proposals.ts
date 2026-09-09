/**
 * External Agent Proposals (P8 slice B) — the app side of the MCP sidecar
 * contract (see mcp-server/PROPOSALS.md).
 *
 * External AI agents (Claude Desktop, Claude Code, any MCP client) can never
 * modify an outline directly. They write PROPOSALS into sidecar files
 * (`<outline>.idm.proposals.json`) next to the outline, plus full drafts of
 * proposed NEW outlines under `_proposed-outlines/`. This module is the
 * renderer's typed doorway to those sidecars via Electron IPC:
 *
 *   - list pending proposals (all sidecars + the new-outline drafts index)
 *   - read a proposed-outline draft
 *   - write back a resolution (approved / rejected / dismissed) so the MCP
 *     server's `list_proposals` reflects what the owner decided
 *   - subscribe to live sidecar changes (the main process watches the
 *     outlines folder cheaply with fs.watch)
 *
 * Everything here is read/write of *.proposals.json + _proposed-outlines only.
 * The user's .idm outline files are NEVER touched by this module — approving a
 * proposal applies the change through the app's normal in-memory state paths
 * (undo-backed), and the standard dirty-flag autosave persists it like any
 * hand-made edit.
 *
 * Outside Electron (web/iOS) the feature is simply absent: every function
 * no-ops gracefully and the UI entry point never renders.
 */

import type { Outline, OutlineNode } from '@/types';
import { isElectron } from '@/lib/electron-storage';

// ── Types (mirrors mcp-server/PROPOSALS.md v1) ───────────────────────────────

export type AgentProposalKind =
  | 'add_node'
  | 'rewrite_node'
  | 'move_node'
  | 'delete_node'
  | 'new_outline';

export interface AgentProposalPayload {
  // add_node
  parentId?: string;
  name?: string;
  content?: string;
  position?: number | null;
  // rewrite_node
  addTags?: string[];
  removeTags?: string[];
  previous?: { name?: string; content?: string; tags?: string[] };
  // move_node
  newParentId?: string;
  newParentPath?: string;
  previousParentId?: string;
  // delete_node
  nodeName?: string;
  descendantCount?: number;
  // new_outline
  draftFileName?: string;
  draftFolder?: string;
  rootNodeId?: string;
}

export interface AgentProposal {
  id: string;
  createdAt: string;
  agent: string;
  kind: AgentProposalKind;
  outlineFileName: string;
  targetNodeId: string | null;
  targetNodePath?: string;
  payload: AgentProposalPayload;
  /** 'pending' | 'withdrawn' (server-owned) | 'approved' | 'rejected' | 'dismissed' (app-owned) */
  status: string;
  /** Which sidecar file this proposal lives in (relative to the outlines dir).
   *  Added by the Electron main process when listing. */
  sidecarFileName: string;
}

export type AgentProposalResolution = 'approved' | 'rejected' | 'dismissed';

// ── Availability ─────────────────────────────────────────────────────────────

/** True when the desktop app can see MCP proposal sidecars at all. */
export function agentProposalsAvailable(): boolean {
  return isElectron() && typeof window.electronAPI?.proposalsList === 'function';
}

// ── IPC wrappers ─────────────────────────────────────────────────────────────

/** All PENDING proposals across every sidecar (withdrawn/resolved filtered out). */
export async function listAgentProposals(): Promise<AgentProposal[]> {
  if (!agentProposalsAvailable()) return [];
  try {
    const api = window.electronAPI!;
    const dirPath = await api.getStoredDirectoryPath();
    if (!dirPath) return [];
    const result = await api.proposalsList!(dirPath);
    if (!result?.success || !Array.isArray(result.proposals)) return [];
    return (result.proposals as AgentProposal[]).filter(
      (p) => p && p.status === 'pending' && typeof p.id === 'string' && typeof p.kind === 'string'
    );
  } catch (err) {
    console.error('[AgentProposals] list failed:', err);
    return [];
  }
}

/** Write the owner's decision back into the sidecar (server tolerates app-owned statuses). */
export async function resolveAgentProposal(
  sidecarFileName: string,
  proposalId: string,
  status: AgentProposalResolution
): Promise<boolean> {
  if (!agentProposalsAvailable()) return false;
  try {
    const api = window.electronAPI!;
    const dirPath = await api.getStoredDirectoryPath();
    if (!dirPath) return false;
    const result = await api.proposalsResolve!({ dirPath, sidecarFileName, proposalId, status });
    return !!result?.success;
  } catch (err) {
    console.error('[AgentProposals] resolve failed:', err);
    return false;
  }
}

/** Read a proposed-new-outline draft from `_proposed-outlines/`. */
export async function readProposedOutlineDraft(draftFileName: string): Promise<Outline | null> {
  if (!agentProposalsAvailable()) return null;
  try {
    const api = window.electronAPI!;
    const dirPath = await api.getStoredDirectoryPath();
    if (!dirPath) return null;
    const result = await api.proposalsReadDraft!(dirPath, draftFileName);
    if (result?.success && result.outline) return result.outline as Outline;
    return null;
  } catch (err) {
    console.error('[AgentProposals] readDraft failed:', err);
    return null;
  }
}

/** Subscribe to live sidecar changes. Returns an unsubscribe fn (or null outside Electron). */
export function onAgentProposalsChanged(callback: () => void): (() => void) | null {
  if (!isElectron() || typeof window.electronAPI?.onProposalsChanged !== 'function') return null;
  return window.electronAPI.onProposalsChanged(callback);
}

// ── Plain-English descriptions ───────────────────────────────────────────────

function lastPathSegment(p?: string): string | null {
  if (!p) return null;
  const parts = p.split('>').map((s) => s.trim()).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : null;
}

/** "Claude Desktop suggests adding 'X' under 'Y'." */
export function describeAgentProposal(p: AgentProposal, outline?: Outline): string {
  const agent = p.agent || 'An AI assistant';
  const target =
    (outline && p.targetNodeId && outline.nodes[p.targetNodeId]?.name) ||
    lastPathSegment(p.targetNodePath) ||
    'an item';
  switch (p.kind) {
    case 'add_node':
      return `${agent} suggests adding "${p.payload.name || 'a new item'}" under "${target}".`;
    case 'rewrite_node': {
      const what: string[] = [];
      if (p.payload.name !== undefined) what.push('the title');
      if (p.payload.content !== undefined) what.push('the content');
      if ((p.payload.addTags?.length || 0) + (p.payload.removeTags?.length || 0) > 0) what.push('the tags');
      const parts = what.length > 0 ? what.join(' and ') : 'this item';
      return `${agent} suggests changing ${parts} of "${target}".`;
    }
    case 'move_node': {
      const dest = lastPathSegment(p.payload.newParentPath) || 'another place';
      return `${agent} suggests moving "${target}" under "${dest}".`;
    }
    case 'delete_node': {
      const n = p.payload.descendantCount || 0;
      const blast = n > 0 ? ` and the ${n} item${n === 1 ? '' : 's'} inside it` : '';
      return `${agent} suggests removing "${p.payload.nodeName || target}"${blast}.`;
    }
    case 'new_outline':
      return `${agent} suggests a brand-new outline: "${p.payload.name || p.outlineFileName}".`;
    default:
      return `${agent} made a suggestion.`;
  }
}

/** "2h ago" style relative time for the suggestion list. */
export function agentProposalTimeAgo(createdAt: string): string {
  const t = Date.parse(createdAt);
  if (Number.isNaN(t)) return '';
  const diff = Date.now() - t;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

// ── Staleness re-validation (against the LIVE outline, at review time) ───────

export interface AgentProposalValidity {
  ok: boolean;
  /** Owner-facing explanation when not ok. */
  staleReason?: string;
}

const STALE_CHANGED = 'The outline changed since this was suggested.';
const STALE_GONE = 'The item this refers to is no longer in the outline.';

function isInSubtree(nodes: Record<string, OutlineNode>, candidateId: string, ancestorId: string): boolean {
  let cur: string | null = candidateId;
  while (cur) {
    if (cur === ancestorId) return true;
    cur = nodes[cur]?.parentId ?? null;
  }
  return false;
}

/**
 * Re-validate a proposal against the CURRENT outline state. Proposals were
 * validated at proposal time by the MCP server, but the outline may have
 * changed since — a stale proposal must only be dismissible, never applied.
 * (new_outline drafts are validated separately when the draft file is read.)
 */
export function validateAgentProposal(p: AgentProposal, outline: Outline | undefined): AgentProposalValidity {
  if (p.kind === 'new_outline') return { ok: true };
  if (!outline) return { ok: false, staleReason: 'This outline is not open right now.' };
  const node = p.targetNodeId ? outline.nodes[p.targetNodeId] : undefined;
  if (!node) return { ok: false, staleReason: STALE_GONE };

  switch (p.kind) {
    case 'add_node':
      return { ok: true }; // parent exists — that's all an addition needs
    case 'delete_node':
      if (!node.parentId) return { ok: false, staleReason: 'The top item of an outline cannot be removed.' };
      return { ok: true };
    case 'rewrite_node': {
      const prev = p.payload.previous;
      if (prev) {
        if (prev.name !== undefined && prev.name !== node.name) {
          return { ok: false, staleReason: STALE_CHANGED };
        }
        if (prev.content !== undefined && (prev.content || '') !== (node.content || '')) {
          return { ok: false, staleReason: STALE_CHANGED };
        }
      }
      return { ok: true };
    }
    case 'move_node': {
      const newParentId = p.payload.newParentId;
      if (!node.parentId) return { ok: false, staleReason: 'The top item of an outline cannot be moved.' };
      if (!newParentId || !outline.nodes[newParentId]) {
        return { ok: false, staleReason: STALE_GONE };
      }
      if (newParentId === p.targetNodeId || isInSubtree(outline.nodes, newParentId, p.targetNodeId!)) {
        return { ok: false, staleReason: 'This move is no longer possible (it would fold the item into itself).' };
      }
      return { ok: true };
    }
    default:
      return { ok: false, staleReason: 'This kind of suggestion is not supported yet.' };
  }
}
