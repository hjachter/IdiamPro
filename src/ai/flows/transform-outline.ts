'use server';

/**
 * @fileOverview Transform outline with AI — apply a plain-language
 * transformation to a WHOLE outline subtree's structure.
 *
 * Distinct from `reformat-content.ts` (which operates on a single node's
 * HTML body): this flow walks the outline structure itself — node
 * hierarchy, ordering, splitting/merging nodes, mass renames, content
 * moves. The user describes what should happen ("reorganize
 * alphabetically", "merge sparse chapters into Misc", "promote leaves
 * about X to top-level"), the AI returns a new subtree (nodes + root
 * id + a 1-2 sentence summary), and the dialog shows a
 * preview-and-approve cycle before committing.
 *
 * AI is constrained to:
 *   - Preserve all node IDs that aren't being removed.
 *   - Use NEW_NODE_<n> placeholders for new node IDs; the server action
 *     replaces them with real UUIDs after the model returns.
 *   - Never delete the root node.
 *   - Never produce circular parent/child references.
 *
 * Counts as 1 AI generation (regardless of subtree size).
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { v4 as uuidv4 } from 'uuid';
import { getDefaultGeminiModel, getGeminiModelById, DEFAULT_GEMINI_MODEL_ID } from '@/config/gemini-models';
import { generateWithOllama, isOllamaAvailable, getBestAvailableModel } from '@/lib/ollama-service';
import { requireApiKey } from '@/lib/byok-keys';
import type { NodeMap, OutlineNode, NodeType } from '@/types';

/** Subset of OutlineNode the AI is allowed to read/produce. */
export interface SerializedNode {
  id: string;
  name: string;
  content: string;
  type: NodeType;
  parentId: string | null;
  childrenIds: string[];
}

export interface TransformOutlineInput {
  /** Serialized subtree (root + descendants) handed to the AI. */
  subtreeNodes: Record<string, SerializedNode>;
  /** Root of the subtree being transformed. */
  rootNodeId: string;
  /** Plain-language description of how to transform the subtree. */
  instruction: string;
  /** Optional outline name for context. */
  currentOutlineName?: string;
  /** Force local Ollama. */
  useLocal?: boolean;
  /** Optional BYOK Gemini key. */
  userApiKey?: string | null;
}

export interface TransformOutlineResult {
  /** Full transformed subtree node map. Empty on error. */
  transformedNodes: Record<string, SerializedNode>;
  /** Root of the transformed subtree (same ID as input root unless model swapped, which we reject). */
  transformedRootId: string;
  /** 1-2 sentence plain-English summary of the changes. */
  summary: string;
  /** Truthful counts of structural change. */
  stats: {
    added: number;
    removed: number;
    renamed: number;
    moved: number;
    unchanged: number;
  };
  model: string;
  modelProvider: 'cloud' | 'local';
  changed: boolean;
  error?: string;
}

const SYSTEM_INSTRUCTIONS = `You are transforming the STRUCTURE of an outline subtree for a professional outlining app.

You will receive:
1. The user's plain-language instruction describing what to do.
2. A JSON object representing the subtree — every node has an id, name, content (HTML), type, parentId, and childrenIds array.

Your job: produce a transformed version of the subtree that follows the user's instruction.

OUTPUT FORMAT — REPLY WITH JSON ONLY. NO MARKDOWN. NO PROSE BEFORE OR AFTER. NO CODE FENCES.

The JSON must be exactly:
{
  "nodes": { "<nodeId>": { "id": "...", "name": "...", "content": "...", "type": "...", "parentId": "..." | null, "childrenIds": ["..."] } },
  "rootNodeId": "<the same root id you were given>",
  "summary": "<1-2 sentence plain-English description of what changed>"
}

CORE RULES — VIOLATING THESE WILL CAUSE THE TRANSFORM TO BE REJECTED:
- Preserve every node ID for any node that you keep. Do NOT change existing IDs.
- For NEW nodes, use a placeholder ID of the form NEW_NODE_1, NEW_NODE_2, NEW_NODE_3, etc. The server will replace these with real UUIDs after you return.
- Never delete the ROOT node. The rootNodeId in your output must match the rootNodeId in the input.
- Every node's parentId must reference a node that EXISTS in your output (or be null for the root only).
- Every node's childrenIds must reference nodes that EXIST in your output.
- A node's parentId and childrenIds must be CONSISTENT — if node A's childrenIds contains B, then B's parentId must be A.
- Never create circular parent/child relationships (a node cannot be its own ancestor).
- Preserve each node's TYPE unless the user explicitly asks to change it.
- Preserve content (HTML) for nodes you keep, unless the instruction explicitly asks to rewrite content.

GUIDELINES:
- If the user asks to "reorganize" or "sort" — change ordering and grouping; don't invent new content.
- If the user asks to "merge" — combine multiple nodes into one, possibly putting their original content as paragraphs under the merged node.
- If the user asks to "split" or "promote" — create new structural parents or move leaves up.
- If the user asks to "rename" — change node names; preserve everything else.
- If the user asks for something destructive, do your best with the spirit of the request — never produce malformed JSON.
- If the instruction is ambiguous, pick the simplest interpretation that improves clarity of the outline structure.

OUTPUT JSON ONLY.`;

function buildPrompt(input: TransformOutlineInput): string {
  return `${SYSTEM_INSTRUCTIONS}

OUTLINE NAME: ${input.currentOutlineName || '(untitled)'}

USER INSTRUCTION:
"""
${input.instruction.trim() || '(no instruction provided)'}
"""

ROOT NODE ID: ${input.rootNodeId}

CURRENT SUBTREE (JSON):
"""
${JSON.stringify({ nodes: input.subtreeNodes, rootNodeId: input.rootNodeId }, null, 2)}
"""

Reply with ONLY the JSON object described above. No preamble, no code fences, no commentary.`;
}

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json|JSON)?\n?([\s\S]*?)\n?```$/);
  if (fenceMatch) return fenceMatch[1].trim();
  return trimmed;
}

interface ParsedAIResponse {
  nodes: Record<string, SerializedNode>;
  rootNodeId: string;
  summary: string;
}

function parseAIResponse(rawText: string): ParsedAIResponse | { parseError: string } {
  const cleaned = stripCodeFences(rawText);
  if (!cleaned) return { parseError: 'The AI returned an empty reply.' };
  try {
    const data = JSON.parse(cleaned);
    if (!data || typeof data !== 'object') {
      return { parseError: 'The AI reply was not a JSON object.' };
    }
    if (!data.nodes || typeof data.nodes !== 'object') {
      return { parseError: 'The AI reply is missing a "nodes" map.' };
    }
    if (typeof data.rootNodeId !== 'string') {
      return { parseError: 'The AI reply is missing a "rootNodeId".' };
    }
    const summary = typeof data.summary === 'string' ? data.summary : '';
    return { nodes: data.nodes, rootNodeId: data.rootNodeId, summary };
  } catch (err) {
    return {
      parseError:
        'I couldn\'t make sense of the AI\'s reply — it wasn\'t valid JSON. Try rephrasing the instruction more simply.',
    };
  }
}

/**
 * Replace all NEW_NODE_<n> placeholder IDs with fresh UUIDs throughout the
 * returned subtree. Mutates a copy; returns the rewritten map.
 */
function replaceNewNodePlaceholders(
  nodes: Record<string, SerializedNode>,
): Record<string, SerializedNode> {
  const idMap = new Map<string, string>();
  for (const id of Object.keys(nodes)) {
    if (id.startsWith('NEW_NODE_')) idMap.set(id, uuidv4());
  }
  if (idMap.size === 0) return nodes;
  const remap = (id: string): string => idMap.get(id) || id;
  const next: Record<string, SerializedNode> = {};
  for (const [oldId, node] of Object.entries(nodes)) {
    const newId = remap(oldId);
    next[newId] = {
      ...node,
      id: newId,
      parentId: node.parentId === null ? null : remap(node.parentId),
      childrenIds: (node.childrenIds || []).map(remap),
    };
  }
  return next;
}

/**
 * Validate the AI's returned subtree against the contract.
 * Returns null on success, a user-facing error string on failure.
 */
function validateSubtree(
  parsed: ParsedAIResponse,
  expectedRootId: string,
): string | null {
  if (parsed.rootNodeId !== expectedRootId) {
    return 'The AI tried to change the root node, which is not allowed.';
  }
  const nodes = parsed.nodes;
  const ids = Object.keys(nodes);
  if (ids.length === 0) return 'The AI returned an empty subtree.';
  if (!nodes[expectedRootId]) {
    return 'The AI dropped the root node, which is not allowed.';
  }
  for (const [id, node] of Object.entries(nodes)) {
    if (!node || typeof node !== 'object') return `Node "${id}" is malformed.`;
    if (node.id !== id) return `Node "${id}" has a mismatched internal id.`;
    if (typeof node.name !== 'string') return `Node "${id}" is missing a name.`;
    if (typeof node.content !== 'string') return `Node "${id}" is missing content.`;
    if (typeof node.type !== 'string') return `Node "${id}" is missing a type.`;
    if (!Array.isArray(node.childrenIds)) return `Node "${id}" has bad childrenIds.`;
    if (id === expectedRootId) {
      // Root parent must be null OR original (we allow null here for the
      // subtree case; the caller preserves the original parentId on apply).
    } else {
      if (typeof node.parentId !== 'string') {
        return `Node "${id}" is missing a parentId.`;
      }
      if (!nodes[node.parentId]) {
        return `Node "${id}" points at a parent that doesn't exist.`;
      }
    }
    for (const childId of node.childrenIds) {
      if (!nodes[childId]) {
        return `Node "${id}" references a child "${childId}" that doesn't exist.`;
      }
      const child = nodes[childId];
      if (child.parentId !== id) {
        return `Node "${id}" claims "${childId}" as a child, but the child's parentId doesn't match.`;
      }
    }
  }
  // Circular check: walk up from each non-root node to the root, bail if loop.
  for (const id of ids) {
    if (id === expectedRootId) continue;
    const seen = new Set<string>();
    let cursor: string | null = id;
    while (cursor && cursor !== expectedRootId) {
      if (seen.has(cursor)) {
        return 'The AI produced a circular parent/child relationship.';
      }
      seen.add(cursor);
      const parentId: string | null = nodes[cursor]?.parentId ?? null;
      cursor = parentId;
    }
    if (cursor !== expectedRootId) {
      return `Node "${id}" isn't connected to the root.`;
    }
  }
  return null;
}

/** Quick structural stats — used to give the user a one-line "what changed". */
function computeStats(
  beforeNodes: Record<string, SerializedNode>,
  afterNodes: Record<string, SerializedNode>,
): TransformOutlineResult['stats'] {
  const beforeIds = new Set(Object.keys(beforeNodes));
  const afterIds = new Set(Object.keys(afterNodes));
  let added = 0;
  let removed = 0;
  let renamed = 0;
  let moved = 0;
  let unchanged = 0;
  for (const id of afterIds) {
    if (!beforeIds.has(id)) {
      added++;
      continue;
    }
    const b = beforeNodes[id];
    const a = afterNodes[id];
    const nameChanged = b.name !== a.name;
    const parentChanged = b.parentId !== a.parentId;
    if (nameChanged) renamed++;
    if (parentChanged) moved++;
    if (!nameChanged && !parentChanged) unchanged++;
  }
  for (const id of beforeIds) {
    if (!afterIds.has(id)) removed++;
  }
  return { added, removed, renamed, moved, unchanged };
}

async function transformWithGemini(input: TransformOutlineInput): Promise<TransformOutlineResult> {
  const apiKey = requireApiKey('gemini', input.userApiKey);
  const modelEntry = getGeminiModelById(DEFAULT_GEMINI_MODEL_ID);
  const modelName = modelEntry?.name || 'Gemini';

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: getDefaultGeminiModel('sdk'),
    generationConfig: { temperature: 0.3, maxOutputTokens: 8192, responseMimeType: 'application/json' },
  });

  const result = await model.generateContent(buildPrompt(input));
  const text = (result.response.text() || '').trim();
  return finalizeAIResponse(input, text, modelName, 'cloud');
}

async function transformWithLocal(input: TransformOutlineInput): Promise<TransformOutlineResult> {
  const available = await isOllamaAvailable();
  if (!available) {
    return emptyResult(
      input,
      'Local',
      'local',
      'Local AI (Ollama) is not running. Start Ollama or switch off local mode.',
    );
  }
  const modelId = (await getBestAvailableModel()) || 'local model';
  const text = (await generateWithOllama({ prompt: buildPrompt(input), maxTokens: 8192, temperature: 0.3 })).trim();
  return finalizeAIResponse(input, text, modelId, 'local');
}

function emptyResult(
  input: TransformOutlineInput,
  modelName: string,
  provider: 'cloud' | 'local',
  error?: string,
): TransformOutlineResult {
  return {
    transformedNodes: input.subtreeNodes,
    transformedRootId: input.rootNodeId,
    summary: '',
    stats: { added: 0, removed: 0, renamed: 0, moved: 0, unchanged: Object.keys(input.subtreeNodes).length },
    model: modelName,
    modelProvider: provider,
    changed: false,
    error,
  };
}

function finalizeAIResponse(
  input: TransformOutlineInput,
  rawText: string,
  modelName: string,
  provider: 'cloud' | 'local',
): TransformOutlineResult {
  const parsed = parseAIResponse(rawText);
  if ('parseError' in parsed) {
    return emptyResult(input, modelName, provider, parsed.parseError);
  }
  const remapped = replaceNewNodePlaceholders(parsed.nodes);
  const validationError = validateSubtree(
    { nodes: remapped, rootNodeId: parsed.rootNodeId, summary: parsed.summary },
    input.rootNodeId,
  );
  if (validationError) {
    return emptyResult(input, modelName, provider, validationError);
  }
  const stats = computeStats(input.subtreeNodes, remapped);
  const changed = stats.added > 0 || stats.removed > 0 || stats.renamed > 0 || stats.moved > 0;
  return {
    transformedNodes: remapped,
    transformedRootId: input.rootNodeId,
    summary: parsed.summary || (changed ? 'Applied the requested structural changes.' : 'No structural changes were needed.'),
    stats,
    model: modelName,
    modelProvider: provider,
    changed,
  };
}

export async function transformOutline(
  input: TransformOutlineInput,
): Promise<TransformOutlineResult> {
  if (input.useLocal) return transformWithLocal(input);
  try {
    return await transformWithGemini(input);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const local = await transformWithLocal({ ...input, useLocal: true });
    if (local.error) {
      return {
        ...local,
        error: `Cloud transform didn't work (${message}); local AI is also unavailable: ${local.error}`,
      };
    }
    return local;
  }
}

/**
 * Helper for the client: serialize a NodeMap subtree (root + descendants only)
 * into the SerializedNode shape the AI flow expects.
 */
export function serializeSubtree(
  nodes: NodeMap,
  rootId: string,
): { subtreeNodes: Record<string, SerializedNode>; count: number } {
  const out: Record<string, SerializedNode> = {};
  const walk = (id: string) => {
    const n = nodes[id];
    if (!n) return;
    out[id] = {
      id: n.id,
      name: n.name,
      content: n.content,
      type: n.type,
      parentId: n.parentId,
      childrenIds: [...(n.childrenIds || [])],
    };
    for (const childId of n.childrenIds || []) walk(childId);
  };
  walk(rootId);
  return { subtreeNodes: out, count: Object.keys(out).length };
}

/**
 * Helper for the client: take a NodeMap + a transformed subtree and produce
 * a new NodeMap with the subtree replaced. Preserves the original prefix on
 * the root, and re-uses prefixes from the original where node IDs match.
 *
 * Nodes that previously lived under the rootId but no longer appear in the
 * transformed subtree are dropped — that's the "removed" set the AI returned.
 */
export function mergeTransformedSubtreeIntoOutline(
  originalNodes: NodeMap,
  transformed: Record<string, SerializedNode>,
  rootId: string,
): NodeMap {
  // Identify which IDs in the original belong to the subtree (root + descendants).
  const originalSubtreeIds = new Set<string>();
  const walk = (id: string) => {
    const n = originalNodes[id];
    if (!n) return;
    originalSubtreeIds.add(id);
    for (const childId of n.childrenIds || []) walk(childId);
  };
  walk(rootId);

  // Start from everything OUTSIDE the original subtree (untouched).
  const next: NodeMap = {};
  for (const [id, n] of Object.entries(originalNodes)) {
    if (!originalSubtreeIds.has(id)) next[id] = n;
  }

  // Merge in the transformed subtree, mapping serialized nodes back into
  // full OutlineNode shape by re-using the original node's fields where
  // possible (prefix, metadata) and falling back to defaults for new nodes.
  for (const [id, serialized] of Object.entries(transformed)) {
    const original = originalNodes[id];
    const fullNode: OutlineNode = original
      ? {
          ...original,
          name: serialized.name,
          content: serialized.content,
          type: serialized.type,
          parentId: serialized.parentId,
          childrenIds: serialized.childrenIds,
        }
      : {
          id,
          name: serialized.name,
          content: serialized.content,
          type: serialized.type,
          parentId: serialized.parentId,
          childrenIds: serialized.childrenIds,
          prefix: '',
          metadata: { createdAt: Date.now(), updatedAt: Date.now() },
        };
    next[id] = fullNode;
  }

  // Preserve the parentId on the subtree's root from the ORIGINAL node — the
  // AI doesn't know the subtree's place inside the larger outline, so we
  // restore that anchor regardless of what the AI put there.
  const originalRoot = originalNodes[rootId];
  if (originalRoot && next[rootId]) {
    next[rootId] = { ...next[rootId], parentId: originalRoot.parentId };
  }

  return next;
}
