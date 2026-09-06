import { readFile, writeFile, mkdir, readdir } from "fs/promises";
import { join, resolve, sep } from "path";
import { randomUUID } from "crypto";

// ============================================
// Proposal types — the sidecar contract
//
// External AI agents never modify a real .idm outline.
// Every requested change is recorded as a Proposal in a
// sidecar file next to the outline it targets:
//
//     <outline file name>.proposals.json
//     e.g.  "My Plan.idm.proposals.json"
//
// New-outline drafts live in the `_proposed-outlines/`
// subfolder (full .idm drafts + a `_proposals.json` index),
// never in the live outline folder root.
//
// The IdeaM app's Proposed Changes engine consumes these
// files; the human owner approves or rejects in the app.
// See mcp-server/PROPOSALS.md for the full format spec.
// ============================================

/** Mirrors the app's change vocabulary: additions, rewrites, moves, deletions, new outlines. */
export type ProposalKind =
  | "add_node"
  | "rewrite_node"
  | "move_node"
  | "delete_node"
  | "new_outline";

export type ProposalStatus = "pending" | "withdrawn";

export interface Proposal {
  /** Unique proposal id (uuid). */
  id: string;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** Label identifying the proposing agent/source (e.g. "claude-desktop"). */
  agent: string;
  /** What kind of change is proposed. */
  kind: ProposalKind;
  /** Outline file the proposal targets. For new_outline this is the proposed file name. */
  outlineFileName: string;
  /** Node the proposal targets (parent node for add_node; null for new_outline). */
  targetNodeId: string | null;
  /** Human-readable path of node names from root to target, for reviewer context. */
  targetNodePath: string | null;
  /** Kind-specific proposed content (see PROPOSALS.md). */
  payload: Record<string, unknown>;
  /** pending until the human decides in the app, or the agent withdraws it. */
  status: ProposalStatus;
  /** Set when the agent withdraws the proposal. */
  withdrawnAt?: string;
}

export interface NewProposalInput {
  agent: string;
  kind: ProposalKind;
  outlineFileName: string;
  targetNodeId: string | null;
  targetNodePath: string | null;
  payload: Record<string, unknown>;
}

const PROPOSED_OUTLINES_DIR = "_proposed-outlines";
const PROPOSED_INDEX_FILE = "_proposals.json";
const SIDECAR_SUFFIX = ".proposals.json";

/**
 * ProposalStore — the ONLY writer in the MCP server's outline directory.
 *
 * Safety invariant: this class refuses to write any file that does not
 * end in `.proposals.json`, unless it is an outline DRAFT inside the
 * `_proposed-outlines/` subfolder. Real `.idm` outlines in the live
 * folder are therefore unreachable by any write path in this server.
 */
export class ProposalStore {
  private outlineDir: string;

  constructor(outlineDir: string) {
    this.outlineDir = outlineDir;
  }

  // ------------------------------------------
  // Guarded low-level write
  // ------------------------------------------

  private async guardedWrite(filePath: string, data: string): Promise<void> {
    const abs = resolve(filePath);
    const proposedDir = resolve(join(this.outlineDir, PROPOSED_OUTLINES_DIR));
    const isSidecar = abs.endsWith(SIDECAR_SUFFIX);
    const isInProposedDir = abs.startsWith(proposedDir + sep);

    if (!isSidecar && !isInProposedDir) {
      throw new Error(
        `SAFETY: refusing to write ${abs} — this server only writes proposal sidecars and _proposed-outlines drafts, never live outlines.`
      );
    }
    await writeFile(abs, data, "utf-8");
  }

  // ------------------------------------------
  // Sidecar paths
  // ------------------------------------------

  private sidecarPath(outlineFileName: string): string {
    return join(this.outlineDir, `${outlineFileName}${SIDECAR_SUFFIX}`);
  }

  private proposedDir(): string {
    return join(this.outlineDir, PROPOSED_OUTLINES_DIR);
  }

  private proposedIndexPath(): string {
    return join(this.proposedDir(), PROPOSED_INDEX_FILE);
  }

  private async readProposalArray(filePath: string): Promise<Proposal[]> {
    try {
      const raw = await readFile(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as Proposal[]) : [];
    } catch {
      return [];
    }
  }

  // ------------------------------------------
  // Public API
  // ------------------------------------------

  /**
   * Append a proposal to the sidecar for its target outline
   * (or to the _proposed-outlines index for new_outline proposals).
   */
  async addProposal(input: NewProposalInput): Promise<Proposal> {
    const proposal: Proposal = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      agent: input.agent,
      kind: input.kind,
      outlineFileName: input.outlineFileName,
      targetNodeId: input.targetNodeId,
      targetNodePath: input.targetNodePath,
      payload: input.payload,
      status: "pending",
    };

    let filePath: string;
    if (input.kind === "new_outline") {
      await mkdir(this.proposedDir(), { recursive: true });
      filePath = this.proposedIndexPath();
    } else {
      filePath = this.sidecarPath(input.outlineFileName);
    }

    const existing = await this.readProposalArray(filePath);
    existing.push(proposal);
    await this.guardedWrite(filePath, JSON.stringify(existing, null, 2));

    return proposal;
  }

  /**
   * Save a full outline DRAFT for a new_outline proposal.
   * Drafts go ONLY into the _proposed-outlines/ subfolder — never
   * the live outline folder. Returns the draft file name actually used
   * (uniquified if a draft with that name already exists).
   */
  async saveOutlineDraft(fileName: string, outline: unknown): Promise<string> {
    await mkdir(this.proposedDir(), { recursive: true });

    let draftName = fileName;
    const entries = await readdir(this.proposedDir()).catch(() => [] as string[]);
    if (entries.includes(draftName)) {
      const base = draftName.replace(/\.idm$/, "");
      let i = 2;
      while (entries.includes(`${base} (${i}).idm`)) i++;
      draftName = `${base} (${i}).idm`;
    }

    const draftPath = join(this.proposedDir(), draftName);
    await this.guardedWrite(draftPath, JSON.stringify(outline, null, 2));
    return draftName;
  }

  /**
   * List proposals — for one outline, or across all sidecars plus
   * the _proposed-outlines index.
   */
  async listProposals(outlineFileName?: string): Promise<Proposal[]> {
    if (outlineFileName) {
      return this.readProposalArray(this.sidecarPath(outlineFileName));
    }

    const all: Proposal[] = [];
    const entries = await readdir(this.outlineDir).catch(() => [] as string[]);
    for (const entry of entries) {
      if (entry.endsWith(SIDECAR_SUFFIX)) {
        all.push(...(await this.readProposalArray(join(this.outlineDir, entry))));
      }
    }
    all.push(...(await this.readProposalArray(this.proposedIndexPath())));
    all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return all;
  }

  /** Find a single proposal by id across all sidecars. */
  async getProposal(proposalId: string): Promise<Proposal | null> {
    const all = await this.listProposals();
    return all.find((p) => p.id === proposalId) ?? null;
  }

  /**
   * Withdraw a pending proposal (agent retracting its own suggestion).
   * The record is kept with status "withdrawn" — nothing is destroyed.
   * Only pending proposals can be withdrawn; approval/rejection belongs
   * exclusively to the human in the IdeaM app and has no MCP tool.
   */
  async withdrawProposal(
    proposalId: string
  ): Promise<{ ok: boolean; error?: string; proposal?: Proposal }> {
    // Locate the file containing this proposal.
    const candidates: string[] = [];
    const entries = await readdir(this.outlineDir).catch(() => [] as string[]);
    for (const entry of entries) {
      if (entry.endsWith(SIDECAR_SUFFIX)) {
        candidates.push(join(this.outlineDir, entry));
      }
    }
    candidates.push(this.proposedIndexPath());

    for (const filePath of candidates) {
      const proposals = await this.readProposalArray(filePath);
      const idx = proposals.findIndex((p) => p.id === proposalId);
      if (idx === -1) continue;

      const proposal = proposals[idx];
      if (proposal.status !== "pending") {
        return {
          ok: false,
          error: `Proposal is already ${proposal.status} and cannot be withdrawn.`,
        };
      }
      proposal.status = "withdrawn";
      proposal.withdrawnAt = new Date().toISOString();
      await this.guardedWrite(filePath, JSON.stringify(proposals, null, 2));
      return { ok: true, proposal };
    }

    return { ok: false, error: "Proposal not found" };
  }
}
