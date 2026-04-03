import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { randomUUID } from "crypto";
import type { OutlineStorage } from "../storage/outline-storage.js";

/**
 * IdiamPro MCP Server — Free-tier outline tools
 *
 * Registers all MCP tools that let AI assistants read, write,
 * and tag nodes inside .idm outlines.
 */
export function registerOutlineTools(
  server: McpServer,
  storage: OutlineStorage
): void {
  // -------------------------------------------------------
  //  READ OPERATIONS
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
      const outline = await storage.getOutline(fileName);
      if (!outline) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: "Outline not found", fileName }) }],
          isError: true,
        };
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
      const node = await storage.getNode(fileName, nodeId);
      if (!node) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: "Node not found", fileName, nodeId }) }],
          isError: true,
        };
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
  //  WRITE OPERATIONS
  // -------------------------------------------------------

  server.tool(
    "create_node",
    "Create a new node under the specified parent",
    {
      fileName: z.string().describe("The .idm file name"),
      parentId: z.string().describe("Parent node ID"),
      name: z.string().describe("Name / heading for the new node"),
      content: z.string().optional().describe("HTML body content"),
      position: z.number().optional().describe("Insert position among siblings (0-based). Appends at end if omitted"),
    },
    async ({ fileName, parentId, name, content, position }) => {
      const outline = await storage.getOutline(fileName);
      if (!outline) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: "Outline not found", fileName }) }],
          isError: true,
        };
      }

      const parent = outline.nodes[parentId];
      if (!parent) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: "Parent node not found", parentId }) }],
          isError: true,
        };
      }

      const newId = randomUUID();
      const newNode = {
        id: newId,
        name,
        content: content ?? "",
        type: "document" as const,
        parentId,
        childrenIds: [] as string[],
        prefix: "",
      };

      outline.nodes[newId] = newNode;

      if (position !== undefined && position >= 0 && position < parent.childrenIds.length) {
        parent.childrenIds.splice(position, 0, newId);
      } else {
        parent.childrenIds.push(newId);
      }

      outline.lastModified = Date.now();
      await storage.saveOutline(fileName, outline);

      return {
        content: [{ type: "text", text: JSON.stringify({ success: true, nodeId: newId, name }) }],
      };
    }
  );

  server.tool(
    "update_node",
    "Update a node's name and/or content",
    {
      fileName: z.string().describe("The .idm file name"),
      nodeId: z.string().describe("Node ID to update"),
      name: z.string().optional().describe("New name / heading"),
      content: z.string().optional().describe("New HTML body content"),
    },
    async ({ fileName, nodeId, name, content }) => {
      const outline = await storage.getOutline(fileName);
      if (!outline) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: "Outline not found", fileName }) }],
          isError: true,
        };
      }

      const node = outline.nodes[nodeId];
      if (!node) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: "Node not found", nodeId }) }],
          isError: true,
        };
      }

      if (name !== undefined) node.name = name;
      if (content !== undefined) node.content = content;

      outline.lastModified = Date.now();
      await storage.saveOutline(fileName, outline);

      return {
        content: [{ type: "text", text: JSON.stringify({ success: true, nodeId, name: node.name }) }],
      };
    }
  );

  server.tool(
    "delete_node",
    "Remove a node and all its descendants",
    {
      fileName: z.string().describe("The .idm file name"),
      nodeId: z.string().describe("Node ID to delete"),
    },
    async ({ fileName, nodeId }) => {
      const outline = await storage.getOutline(fileName);
      if (!outline) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: "Outline not found", fileName }) }],
          isError: true,
        };
      }

      const node = outline.nodes[nodeId];
      if (!node) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: "Node not found", nodeId }) }],
          isError: true,
        };
      }

      // Prevent deleting the root node
      if (nodeId === outline.rootNodeId) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: "Cannot delete the root node" }) }],
          isError: true,
        };
      }

      // Collect all descendant IDs recursively
      const idsToDelete: string[] = [];
      function collectDescendants(id: string) {
        idsToDelete.push(id);
        const n = outline.nodes[id];
        if (n?.childrenIds) {
          for (const childId of n.childrenIds) {
            collectDescendants(childId);
          }
        }
      }
      collectDescendants(nodeId);

      // Remove from parent's childrenIds
      if (node.parentId && outline.nodes[node.parentId]) {
        const parent = outline.nodes[node.parentId];
        parent.childrenIds = parent.childrenIds.filter((id) => id !== nodeId);
      }

      // Delete all collected nodes
      for (const id of idsToDelete) {
        delete outline.nodes[id];
      }

      outline.lastModified = Date.now();
      await storage.saveOutline(fileName, outline);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, deletedCount: idsToDelete.length }),
          },
        ],
      };
    }
  );

  server.tool(
    "move_node",
    "Move a node to a new parent (optionally at a specific position)",
    {
      fileName: z.string().describe("The .idm file name"),
      nodeId: z.string().describe("Node ID to move"),
      newParentId: z.string().describe("Destination parent node ID"),
      position: z.number().optional().describe("Insert position among new siblings (0-based). Appends at end if omitted"),
    },
    async ({ fileName, nodeId, newParentId, position }) => {
      const outline = await storage.getOutline(fileName);
      if (!outline) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: "Outline not found", fileName }) }],
          isError: true,
        };
      }

      const node = outline.nodes[nodeId];
      if (!node) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: "Node not found", nodeId }) }],
          isError: true,
        };
      }

      const newParent = outline.nodes[newParentId];
      if (!newParent) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: "New parent not found", newParentId }) }],
          isError: true,
        };
      }

      if (nodeId === outline.rootNodeId) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: "Cannot move the root node" }) }],
          isError: true,
        };
      }

      // Prevent moving a node into its own subtree
      function isDescendant(ancestorId: string, candidateId: string): boolean {
        const n = outline.nodes[candidateId];
        if (!n) return false;
        if (n.parentId === ancestorId) return true;
        if (n.parentId) return isDescendant(ancestorId, n.parentId);
        return false;
      }
      if (newParentId === nodeId || isDescendant(nodeId, newParentId)) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: "Cannot move a node into its own subtree" }) }],
          isError: true,
        };
      }

      // Remove from old parent
      if (node.parentId && outline.nodes[node.parentId]) {
        const oldParent = outline.nodes[node.parentId];
        oldParent.childrenIds = oldParent.childrenIds.filter((id) => id !== nodeId);
      }

      // Add to new parent
      if (position !== undefined && position >= 0 && position < newParent.childrenIds.length) {
        newParent.childrenIds.splice(position, 0, nodeId);
      } else {
        newParent.childrenIds.push(nodeId);
      }

      node.parentId = newParentId;

      outline.lastModified = Date.now();
      await storage.saveOutline(fileName, outline);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, nodeId, newParentId }),
          },
        ],
      };
    }
  );

  // -------------------------------------------------------
  //  TAG OPERATIONS
  // -------------------------------------------------------

  server.tool(
    "add_tag",
    "Add a tag to a node",
    {
      fileName: z.string().describe("The .idm file name"),
      nodeId: z.string().describe("Node ID to tag"),
      tag: z.string().describe("Tag string to add"),
    },
    async ({ fileName, nodeId, tag }) => {
      const outline = await storage.getOutline(fileName);
      if (!outline) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: "Outline not found", fileName }) }],
          isError: true,
        };
      }

      const node = outline.nodes[nodeId];
      if (!node) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: "Node not found", nodeId }) }],
          isError: true,
        };
      }

      if (!node.metadata) node.metadata = {};
      if (!node.metadata.tags) node.metadata.tags = [];

      if (node.metadata.tags.includes(tag)) {
        return {
          content: [{ type: "text", text: JSON.stringify({ success: true, message: "Tag already exists", nodeId, tag }) }],
        };
      }

      node.metadata.tags.push(tag);

      outline.lastModified = Date.now();
      await storage.saveOutline(fileName, outline);

      return {
        content: [{ type: "text", text: JSON.stringify({ success: true, nodeId, tag }) }],
      };
    }
  );

  server.tool(
    "remove_tag",
    "Remove a tag from a node",
    {
      fileName: z.string().describe("The .idm file name"),
      nodeId: z.string().describe("Node ID"),
      tag: z.string().describe("Tag string to remove"),
    },
    async ({ fileName, nodeId, tag }) => {
      const outline = await storage.getOutline(fileName);
      if (!outline) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: "Outline not found", fileName }) }],
          isError: true,
        };
      }

      const node = outline.nodes[nodeId];
      if (!node) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: "Node not found", nodeId }) }],
          isError: true,
        };
      }

      const tags = node.metadata?.tags;
      if (!tags || !tags.includes(tag)) {
        return {
          content: [{ type: "text", text: JSON.stringify({ success: true, message: "Tag not found on node", nodeId, tag }) }],
        };
      }

      node.metadata!.tags = tags.filter((t) => t !== tag);
      if (node.metadata!.tags!.length === 0) {
        delete node.metadata!.tags;
      }

      outline.lastModified = Date.now();
      await storage.saveOutline(fileName, outline);

      return {
        content: [{ type: "text", text: JSON.stringify({ success: true, nodeId, tag }) }],
      };
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
        const outline = await storage.getOutline(fileName);
        if (!outline) {
          return {
            content: [{ type: "text", text: JSON.stringify({ error: "Outline not found", fileName }) }],
            isError: true,
          };
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
          const outline = await storage.getOutline(info.fileName);
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
        const outline = await storage.getOutline(fn);
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
    "Create a brand-new outline file with a root node",
    {
      name: z.string().describe("Name for the new outline"),
      fileName: z.string().optional().describe("File name (auto-generated from name if omitted). Must end in .idm"),
    },
    async ({ name, fileName: requestedFileName }) => {
      const fileName =
        requestedFileName && requestedFileName.endsWith(".idm")
          ? requestedFileName
          : `${name.replace(/[^a-zA-Z0-9 _-]/g, "").trim()}.idm`;

      // Check if file already exists
      const existing = await storage.getOutline(fileName).catch(() => null);
      if (existing) {
        return {
          content: [
            { type: "text", text: JSON.stringify({ error: "Outline already exists", fileName }) },
          ],
          isError: true,
        };
      }

      const rootId = randomUUID();
      const outline = {
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

      await storage.saveOutline(fileName, outline);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              fileName,
              outlineId: outline.id,
              rootNodeId: rootId,
            }),
          },
        ],
      };
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
      const outline = await storage.getOutline(fileName);
      if (!outline) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: "Outline not found", fileName }) }],
          isError: true,
        };
      }

      const fmt = format ?? "markdown";
      const startId = nodeId ?? outline.rootNodeId;
      const startNode = outline.nodes[startId];

      if (!startNode) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: "Node not found", nodeId: startId }) }],
          isError: true,
        };
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
        const node = outline.nodes[id];
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
}
