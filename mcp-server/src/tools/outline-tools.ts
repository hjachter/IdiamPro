import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { randomUUID } from "crypto";
import type { OutlineStorage, Outline } from "../storage/outline-storage.js";
import type { ProposalStore, ProposalKind } from "../storage/proposal-store.js";

/**
 * IdiamPro MCP Server — outline tools (proposal-based trust model)
 *
 * READ tools return live outline data directly.
 *
 * WRITE tools NEVER mutate a real .idm outline. Each mutating call is
 * validated against the live outline, then recorded as a pending
 * PROPOSAL in a sidecar file (`<file>.proposals.json`) — or, for new
 * outlines, as a draft in `_proposed-outlines/`. The outline owner
 * reviews and approves proposals inside the IdeaM app; there is
 * deliberately NO approve tool over MCP.
 *
 * Tool names are unchanged from v0.1 for client back-compat — the
 * semantics changed from "do it" to "propose it", and every response
 * says so explicitly.
 */

const PROPOSAL_NOTICE =
  "Recorded as a pending proposal — the outline owner reviews and approves changes in IdeaM; nothing has been changed yet.";

export function registerOutlineTools(
  server: McpServer,
  storage: OutlineStorage,
  proposals: ProposalStore,
  agentLabel: string
): void {
  // -------------------------------------------------------
  //  Shared helpers
  // -------------------------------------------------------

  function nodePath(outline: Outline, nodeId: string): string {
    const parts: string[] = [];
    let current = outline.nodes[nodeId];
    let hops = 0;
    while (current && hops < 200) {
      parts.unshift(current.name);
      current = current.parentId ? outline.nodes[current.parentId] : undefined as any;
      hops++;
    }
    return parts.join(" > ");
  }

  function errorResult(payload: Record<string, unknown>) {
    return {
      content: [{ type: "text" as const, text: JSON.stringify(payload) }],
      isError: true as const,
    };
  }

  async function propose(
    kind: ProposalKind,
    outlineFileName: string,
    targetNodeId: string | null,
    targetNodePath: string | null,
    payload: Record<string, unknown>,
    extra: Record<string, unknown> = {}
  ) {
    const proposal = await proposals.addProposal({
      agent: agentLabel,
      kind,
      outlineFileName,
      targetNodeId,
      targetNodePath,
      payload,
    });
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              status: "proposed",
              proposalId: proposal.id,
              kind,
              outlineFileName,
              ...extra,
              message: PROPOSAL_NOTICE,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  // -------------------------------------------------------
  //  READ OPERATIONS (direct, unchanged)
  // -------------------------------------------------------

  server.tool(
    "list_outlines",
    "List all outlines with name, fileName, nodeCount, and lastModified",
    {},
    async () => {
      const outlines = await storage.listOutlines();
      return {
        content: [{ type: "text", text: JSON.stringify(outlines, null, 2) }],
      };
    }
  );

  server.tool(
    "get_outline",
    "Return the full outline structure for a given file",
    { fileName: z.string().describe("The .idm file name") },
    async ({ fileName }) => {
      const outline = await storage.getOutline(fileName).catch(() => null);
      if (!outline) {
        return errorResult({ error: "Outline not found", fileName });
      }
      return {
        content: [{ type: "text", text: JSON.stringify(outline, null, 2) }],
      };
    }
  );

  server.tool(
    "get_node",
    "Return a single node and its content from an outline",
    {
      fileName: z.string().describe("The .idm file name"),
      nodeId: z.string().describe("The node ID to retrieve"),
    },
    async ({ fileName, nodeId }) => {
      const node = await storage.getNode(fileName, nodeId).catch(() => null);
      if (!node) {
        return errorResult({ error: "Node not found", fileName, nodeId });
      }
      return {
        content: [{ type: "text", text: JSON.stringify(node, null, 2) }],
      };
    }
  );

  server.tool(
    "search_nodes",
    "Search for nodes matching a query across one or all outlines",
    {
      query: z.string().describe("Search text"),
      fileName: z.string().optional().describe("Limit search to this outline"),
      searchNames: z.boolean().optional().describe("Search node names (default true)"),
      searchContent: z.boolean().optional().describe("Search node content (default true)"),
    },
    async ({ query, fileName, searchNames, searchContent }) => {
      const results = await storage.searchNodes(query, {
        fileName,
        searchNames: searchNames ?? true,
        searchContent: searchContent ?? true,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      };
    }
  );

  // -------------------------------------------------------
  //  WRITE OPERATIONS → PROPOSALS
  //  (validated against the live outline, then recorded as
  //   pending proposals; the .idm file is never touched)
  // -------------------------------------------------------

  server.tool(
    "create_node",
    "PROPOSE a new node under the specified parent. Nothing is changed until the outline owner approves the proposal in IdeaM.",
    {
      fileName: z.string().describe("The .idm file name"),
      parentId: z.string().describe("Parent node ID"),
      name: z.string().describe("Name / heading for the new node"),
      content: z.string().optional().describe("HTML body content"),
      position: z.number().optional().describe("Insert position among siblings (0-based). Appends at end if omitted"),
    },
    async ({ fileName, parentId, name, content, position }) => {
      const outline = await storage.getOutline(fileName).catch(() => null);
      if (!outline) {
        return errorResult({ error: "Outline not found", fileName });
      }
      const parent = outline.nodes[parentId];
      if (!parent) {
        return errorResult({ error: "Parent node not found", parentId });
      }

      return propose(
        "add_node",
        fileName,
        parentId,
        nodePath(outline, parentId),
        {
          parentId,
          name,
          content: content ?? "",
          position: position ?? null,
        }
      );
    }
  );

  server.tool(
    "update_node",
    "PROPOSE a rewrite of a node's name and/or content. Nothing is changed until the outline owner approves the proposal in IdeaM.",
    {
      fileName: z.string().describe("The .idm file name"),
      nodeId: z.string().describe("Node ID to update"),
      name: z.string().optional().describe("New name / heading"),
      content: z.string().optional().describe("New HTML body content"),
    },
    async ({ fileName, nodeId, name, content }) => {
      const outline = await storage.getOutline(fileName).catch(() => null);
      if (!outline) {
        return errorResult({ error: "Outline not found", fileName });
      }
      const node = outline.nodes[nodeId];
      if (!node) {
        return errorResult({ error: "Node not found", nodeId });
      }
      if (name === undefined && content === undefined) {
        return errorResult({ error: "Nothing to propose: provide name and/or content" });
      }

      return propose(
        "rewrite_node",
        fileName,
        nodeId,
        nodePath(outline, nodeId),
        {
          ...(name !== undefined ? { name } : {}),
          ...(content !== undefined ? { content } : {}),
          previous: { name: node.name, content: node.content },
        }
      );
    }
  );

  server.tool(
    "delete_node",
    "PROPOSE removing a node and all its descendants. Nothing is changed until the outline owner approves the proposal in IdeaM.",
    {
      fileName: z.string().describe("The .idm file name"),
      nodeId: z.string().describe("Node ID to delete"),
    },
    async ({ fileName, nodeId }) => {
      const outline = await storage.getOutline(fileName).catch(() => null);
      if (!outline) {
        return errorResult({ error: "Outline not found", fileName });
      }
      const node = outline.nodes[nodeId];
      if (!node) {
        return errorResult({ error: "Node not found", nodeId });
      }
      if (nodeId === outline.rootNodeId) {
        return errorResult({ error: "Cannot propose deleting the root node" });
      }

      // Count descendants so the reviewer sees the blast radius.
      let descendantCount = 0;
      const stack = [...(node.childrenIds ?? [])];
      while (stack.length > 0) {
        const id = stack.pop()!;
        descendantCount++;
        const n = outline.nodes[id];
        if (n?.childrenIds) stack.push(...n.childrenIds);
      }

      return propose(
        "delete_node",
        fileName,
        nodeId,
        nodePath(outline, nodeId),
        {
          nodeName: node.name,
          descendantCount,
        }
      );
    }
  );

  server.tool(
    "move_node",
    "PROPOSE moving a node to a new parent (optionally at a specific position). Nothing is changed until the outline owner approves the proposal in IdeaM.",
    {
      fileName: z.string().describe("The .idm file name"),
      nodeId: z.string().describe("Node ID to move"),
      newParentId: z.string().describe("Destination parent node ID"),
      position: z.number().optional().describe("Insert position among new siblings (0-based). Appends at end if omitted"),
    },
    async ({ fileName, nodeId, newParentId, position }) => {
      const outline = await storage.getOutline(fileName).catch(() => null);
      if (!outline) {
        return errorResult({ error: "Outline not found", fileName });
      }
      const node = outline.nodes[nodeId];
      if (!node) {
        return errorResult({ error: "Node not found", nodeId });
      }
      const newParent = outline.nodes[newParentId];
      if (!newParent) {
        return errorResult({ error: "New parent not found", newParentId });
      }
      if (nodeId === outline.rootNodeId) {
        return errorResult({ error: "Cannot propose moving the root node" });
      }

      function isDescendant(ancestorId: string, candidateId: string): boolean {
        const n = outline!.nodes[candidateId];
        if (!n) return false;
        if (n.parentId === ancestorId) return true;
        if (n.parentId) return isDescendant(ancestorId, n.parentId);
        return false;
      }
      if (newParentId === nodeId || isDescendant(nodeId, newParentId)) {
        return errorResult({ error: "Cannot propose moving a node into its own subtree" });
      }

      return propose(
        "move_node",
        fileName,
        nodeId,
        nodePath(outline, nodeId),
        {
          newParentId,
          newParentPath: nodePath(outline, newParentId),
          position: position ?? null,
          previousParentId: node.parentId,
        }
      );
    }
  );

  // -------------------------------------------------------
  //  TAG OPERATIONS
  //  (tag changes are metadata rewrites → rewrite_node proposals)
  // -------------------------------------------------------

  server.tool(
    "add_tag",
    "PROPOSE adding a tag to a node. Nothing is changed until the outline owner approves the proposal in IdeaM.",
    {
      fileName: z.string().describe("The .idm file name"),
      nodeId: z.string().describe("Node ID to tag"),
      tag: z.string().describe("Tag string to add"),
    },
    async ({ fileName, nodeId, tag }) => {
      const outline = await storage.getOutline(fileName).catch(() => null);
      if (!outline) {
        return errorResult({ error: "Outline not found", fileName });
      }
      const node = outline.nodes[nodeId];
      if (!node) {
        return errorResult({ error: "Node not found", nodeId });
      }
      if (node.metadata?.tags?.includes(tag)) {
        return errorResult({ error: "Tag already exists on node", nodeId, tag });
      }

      return propose(
        "rewrite_node",
        fileName,
        nodeId,
        nodePath(outline, nodeId),
        {
          addTags: [tag],
          previous: { tags: node.metadata?.tags ?? [] },
        },
        { tag }
      );
    }
  );

  server.tool(
    "remove_tag",
    "PROPOSE removing a tag from a node. Nothing is changed until the outline owner approves the proposal in IdeaM.",
    {
      fileName: z.string().describe("The .idm file name"),
      nodeId: z.string().describe("Node ID"),
      tag: z.string().describe("Tag string to remove"),
    },
    async ({ fileName, nodeId, tag }) => {
      const outline = await storage.getOutline(fileName).catch(() => null);
      if (!outline) {
        return errorResult({ error: "Outline not found", fileName });
      }
      const node = outline.nodes[nodeId];
      if (!node) {
        return errorResult({ error: "Node not found", nodeId });
      }
      if (!node.metadata?.tags?.includes(tag)) {
        return errorResult({ error: "Tag not found on node", nodeId, tag });
      }

      return propose(
        "rewrite_node",
        fileName,
        nodeId,
        nodePath(outline, nodeId),
        {
          removeTags: [tag],
          previous: { tags: node.metadata?.tags ?? [] },
        },
        { tag }
      );
    }
  );

  server.tool(
    "list_tags",
    "List all unique tags, optionally filtered to one outline",
    {
      fileName: z.string().optional().describe("Limit to this outline"),
    },
    async ({ fileName }) => {
      const tagSet = new Set<string>();

      if (fileName) {
        const outline = await storage.getOutline(fileName).catch(() => null);
        if (!outline) {
          return errorResult({ error: "Outline not found", fileName });
        }
        for (const node of Object.values(outline.nodes)) {
          if ((node as any).metadata?.tags) {
            for (const tag of (node as any).metadata.tags) {
              tagSet.add(tag);
            }
          }
        }
      } else {
        const outlineList = await storage.listOutlines();
        for (const info of outlineList) {
          const outline = await storage.getOutline(info.fileName).catch(() => null);
          if (!outline) continue;
          for (const node of Object.values(outline.nodes)) {
            if ((node as any).metadata?.tags) {
              for (const tag of (node as any).metadata.tags) {
                tagSet.add(tag);
              }
            }
          }
        }
      }

      const tags = Array.from(tagSet).sort();
      return {
        content: [{ type: "text", text: JSON.stringify({ tags, count: tags.length }) }],
      };
    }
  );

  server.tool(
    "filter_by_tags",
    "Return nodes matching any of the given tags",
    {
      tags: z.array(z.string()).describe("Tags to filter by (matches ANY)"),
      fileName: z.string().optional().describe("Limit to this outline"),
    },
    async ({ tags, fileName }) => {
      interface MatchedNode {
        fileName: string;
        nodeId: string;
        name: string;
        matchedTags: string[];
      }

      const results: MatchedNode[] = [];

      async function scanOutline(fn: string) {
        const outline = await storage.getOutline(fn).catch(() => null);
        if (!outline) return;
        for (const [id, node] of Object.entries(outline.nodes)) {
          const nodeTags = (node as any).metadata?.tags as string[] | undefined;
          if (!nodeTags) continue;
          const matched = tags.filter((t) => nodeTags.includes(t));
          if (matched.length > 0) {
            results.push({
              fileName: fn,
              nodeId: id,
              name: (node as any).name,
              matchedTags: matched,
            });
          }
        }
      }

      if (fileName) {
        await scanOutline(fileName);
      } else {
        const outlineList = await storage.listOutlines();
        for (const info of outlineList) {
          await scanOutline(info.fileName);
        }
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ results, count: results.length }, null, 2),
          },
        ],
      };
    }
  );

  // -------------------------------------------------------
  //  OUTLINE-LEVEL OPERATIONS
  // -------------------------------------------------------

  server.tool(
    "create_outline",
    "PROPOSE a brand-new outline. A full draft is saved in the _proposed-outlines folder; nothing appears among the owner's outlines until approved in IdeaM.",
    {
      name: z.string().describe("Name for the new outline"),
      fileName: z.string().optional().describe("File name (auto-generated from name if omitted). Must end in .idm"),
    },
    async ({ name, fileName: requestedFileName }) => {
      const fileName =
        requestedFileName && requestedFileName.endsWith(".idm")
          ? requestedFileName
          : `${name.replace(/[^a-zA-Z0-9 _-]/g, "").trim()}.idm`;

      // Refuse to shadow an existing live outline.
      const existing = await storage.getOutline(fileName).catch(() => null);
      if (existing) {
        return errorResult({ error: "Outline already exists", fileName });
      }

      const rootId = randomUUID();
      const draft = {
        id: randomUUID(),
        name,
        rootNodeId: rootId,
        nodes: {
          [rootId]: {
            id: rootId,
            name,
            content: "",
            type: "root" as const,
            parentId: null,
            childrenIds: [] as string[],
            prefix: "",
          },
        },
        createdAt: new Date().toISOString(),
        lastModified: Date.now(),
      };

      const draftFileName = await proposals.saveOutlineDraft(fileName, draft);

      return propose(
        "new_outline",
        fileName,
        null,
        null,
        {
          name,
          draftFileName,
          draftFolder: "_proposed-outlines",
          rootNodeId: rootId,
        },
        { draftFileName }
      );
    }
  );

  server.tool(
    "export_outline",
    "Export an outline as indented Markdown or plain text",
    {
      fileName: z.string().describe("The .idm file name"),
      format: z.enum(["markdown", "text"]).optional().describe("Export format (default: markdown)"),
      nodeId: z.string().optional().describe("Export only this subtree (default: entire outline)"),
    },
    async ({ fileName, format, nodeId }) => {
      const outline = await storage.getOutline(fileName).catch(() => null);
      if (!outline) {
        return errorResult({ error: "Outline not found", fileName });
      }

      const fmt = format ?? "markdown";
      const startId = nodeId ?? outline.rootNodeId;
      const startNode = outline.nodes[startId];

      if (!startNode) {
        return errorResult({ error: "Node not found", nodeId: startId });
      }

      function stripHtml(html: string): string {
        if (!html) return "";
        return html
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<\/p>/gi, "\n")
          .replace(/<[^>]*>/g, "")
          .replace(/&nbsp;/gi, " ")
          .replace(/&amp;/gi, "&")
          .replace(/&lt;/gi, "<")
          .replace(/&gt;/gi, ">")
          .replace(/&quot;/gi, '"')
          .replace(/&#39;/gi, "'")
          .trim();
      }

      const lines: string[] = [];

      function renderNode(id: string, depth: number) {
        const node = outline!.nodes[id];
        if (!node) return;

        const indent = "  ".repeat(depth);
        const content = stripHtml(node.content);

        if (fmt === "markdown") {
          if (depth === 0) {
            lines.push(`# ${node.name}`);
          } else if (depth <= 3) {
            lines.push(`${"#".repeat(depth + 1)} ${node.name}`);
          } else {
            lines.push(`${indent}- **${node.name}**`);
          }
          if (content) {
            lines.push("");
            for (const line of content.split("\n")) {
              lines.push(`${depth > 3 ? indent + "  " : ""}${line}`);
            }
          }
          lines.push("");
        } else {
          lines.push(`${indent}${node.name}`);
          if (content) {
            for (const line of content.split("\n")) {
              lines.push(`${indent}  ${line}`);
            }
          }
        }

        for (const childId of node.childrenIds) {
          renderNode(childId, depth + 1);
        }
      }

      renderNode(startId, 0);

      return {
        content: [{ type: "text", text: lines.join("\n") }],
      };
    }
  );

  // -------------------------------------------------------
  //  PROPOSAL MANAGEMENT
  //  (list / inspect / withdraw — there is intentionally NO
  //   approve tool: approval belongs to the human in IdeaM)
  // -------------------------------------------------------

  server.tool(
    "list_proposals",
    "List pending/withdrawn change proposals — for one outline, or all outlines (including proposed new outlines)",
    {
      fileName: z.string().optional().describe("Limit to proposals targeting this .idm file"),
      status: z.enum(["pending", "withdrawn"]).optional().describe("Filter by status"),
    },
    async ({ fileName, status }) => {
      let list = await proposals.listProposals(fileName);
      if (status) list = list.filter((p) => p.status === status);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ proposals: list, count: list.length }, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "get_proposal",
    "Return the full details of a single change proposal by ID",
    {
      proposalId: z.string().describe("The proposal ID"),
    },
    async ({ proposalId }) => {
      const proposal = await proposals.getProposal(proposalId);
      if (!proposal) {
        return errorResult({ error: "Proposal not found", proposalId });
      }
      return {
        content: [{ type: "text", text: JSON.stringify(proposal, null, 2) }],
      };
    }
  );

  server.tool(
    "withdraw_proposal",
    "Withdraw (retract) a pending proposal made by this agent. The record is kept with status 'withdrawn'. Approval of proposals is done by the outline owner in IdeaM — there is no approve tool.",
    {
      proposalId: z.string().describe("The proposal ID to withdraw"),
    },
    async ({ proposalId }) => {
      const result = await proposals.withdrawProposal(proposalId);
      if (!result.ok) {
        return errorResult({ error: result.error, proposalId });
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { status: "withdrawn", proposalId, message: "Proposal withdrawn. Nothing was ever changed in the outline." },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
