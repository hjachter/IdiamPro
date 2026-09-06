# IdeaM Proposal Sidecar Format (v1)

## The trust model, in plain English

External AI agents (Claude Desktop, Claude Code, or any MCP client) can **read**
your outlines freely, but they can **never change them**. When an agent asks to
add, rewrite, move, or delete something, the MCP server records that request as
a **pending proposal** in a small sidecar file next to the outline. Your real
`.idm` files are never touched — byte for byte, they stay exactly as you left
them.

**You** review proposals inside the IdeaM app and decide, one by one, whether
to approve or reject each change. There is deliberately **no approve tool over
MCP** — an external agent cannot approve its own suggestions, and cannot
approve another agent's either. The only thing an agent may do to an existing
proposal is *withdraw* it (retract its own suggestion), which keeps the record
but marks it withdrawn.

Proposed brand-new outlines follow the same rule: the full draft is written to
a `_proposed-outlines/` subfolder, never into your live outline folder, so it
cannot appear in the IdeaM sidebar until you accept it.

## Where proposals live

For an outline `My Plan.idm` in the outlines directory:

```
IDM Outlines/
├── My Plan.idm                      ← never written by the MCP server
├── My Plan.idm.proposals.json       ← sidecar: array of proposals for this outline
└── _proposed-outlines/
    ├── _proposals.json              ← index of new-outline proposals
    └── Project Notes.idm            ← full draft of a proposed new outline
```

- Sidecar file name: `<exact .idm file name>.proposals.json` (append-style array).
- New-outline drafts: full, valid `.idm` JSON inside `_proposed-outlines/`.
  If a draft name collides, the server uniquifies it (`Name (2).idm`).
- The server's write layer is hard-guarded: it refuses (throws) any write that
  is not a `*.proposals.json` sidecar or a file inside `_proposed-outlines/`.

## Proposal record schema

Each sidecar file is a JSON **array** of proposal objects:

```json
{
  "id": "0f8f6c9e-...-uuid",
  "createdAt": "2026-09-05T18:20:11.123Z",
  "agent": "external-ai-agent",
  "kind": "rewrite_node",
  "outlineFileName": "My Plan.idm",
  "targetNodeId": "abc-123",
  "targetNodePath": "My Plan > Marketing > Launch week",
  "payload": { "...kind-specific, see below..." : "..." },
  "status": "pending",
  "withdrawnAt": "(only present after withdrawal)"
}
```

| Field | Meaning |
|---|---|
| `id` | UUID, unique per proposal |
| `createdAt` | ISO-8601 timestamp |
| `agent` | Source label for the proposing agent (server `--agent-label` flag; default `external-ai-agent`) |
| `kind` | One of `add_node`, `rewrite_node`, `move_node`, `delete_node`, `new_outline` — mirrors the app's change vocabulary (additions, rewrites, moves, deletions, new outlines) |
| `outlineFileName` | The `.idm` file targeted (for `new_outline`: the proposed live file name) |
| `targetNodeId` | Node the change applies to (`add_node`: the **parent** node; `new_outline`: `null`) |
| `targetNodePath` | Human-readable "Root > … > Node" path captured at proposal time, for reviewer context |
| `payload` | The proposed content (kind-specific, below) |
| `status` | `pending` or `withdrawn`. Approval/rejection states are the app's to manage — the MCP server never sets them |

## Payloads by kind

**`add_node`** — propose a new child node
```json
{ "parentId": "...", "name": "New heading", "content": "<p>html body</p>", "position": 2 }
```
`position` is 0-based among siblings, or `null` for "append at end".

**`rewrite_node`** — propose changing a node's name, content, and/or tags
```json
{
  "name": "New name (only if changing)",
  "content": "New HTML body (only if changing)",
  "addTags": ["urgent"],
  "removeTags": ["draft"],
  "previous": { "name": "Old name", "content": "Old body", "tags": ["draft"] }
}
```
Only the fields being changed are present. `previous` is a snapshot taken at
proposal time so the app can render a diff and detect staleness (if the node
changed after the proposal was made, the app can flag it).

**`move_node`** — propose re-parenting a node
```json
{ "newParentId": "...", "newParentPath": "Root > Section B", "position": 0, "previousParentId": "..." }
```

**`delete_node`** — propose removing a node and its subtree
```json
{ "nodeName": "Old ideas", "descendantCount": 7 }
```
`descendantCount` shows the reviewer the blast radius before approving.

**`new_outline`** — propose a brand-new outline
```json
{ "name": "Project Notes", "draftFileName": "Project Notes.idm", "draftFolder": "_proposed-outlines", "rootNodeId": "..." }
```
The full draft outline lives at `_proposed-outlines/<draftFileName>`. The
proposal record itself lives in `_proposed-outlines/_proposals.json`.

## Contract for the IdeaM app's Proposed Changes engine

1. Discover sidecars: any `*.proposals.json` beside an outline, plus
   `_proposed-outlines/_proposals.json`.
2. Show `pending` proposals to the owner with the `targetNodePath`, payload,
   and (for rewrites) a diff against `previous`.
3. On approve: apply the change in-app (the app owns the write), then update
   the proposal's status in the sidecar (e.g. `approved` + `resolvedAt`) or
   archive it. Statuses beyond `pending`/`withdrawn` are app-owned; the server
   never writes them and tolerates their presence.
4. On reject: same, with `rejected`.
5. Approving a `new_outline` proposal means moving/copying the draft from
   `_proposed-outlines/` into the live folder.
6. Ignore `withdrawn` proposals (or show them greyed-out in history).

Validation note: proposals are validated against the live outline **at
proposal time** (target exists, no root deletion, no move into own subtree).
The outline may change before review, so the app should re-validate at
approve time and mark impossible proposals as stale.
