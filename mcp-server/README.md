# IdiamPro MCP Server

AI-powered outline access via the [Model Context Protocol](https://modelcontextprotocol.io). Lets AI assistants (Claude Desktop, Claude Code, etc.) read, search, and export IdeaM outlines — and **propose** changes for the owner to approve.

## Trust Model — external agents propose; you approve in IdeaM

Your outlines are **read-only** to external AI agents. Since v0.2.0, no MCP
tool can modify a real `.idm` outline file:

- **Read tools** (list, get, search, tags, export) work directly on your live outlines.
- **Write tools** (create/update/move/delete node, tags, new outline) no longer
  change anything. Each call is validated, then recorded as a **pending
  proposal** in a sidecar file next to the outline
  (`<outline file>.proposals.json`). Proposed brand-new outlines are saved as
  drafts in a `_proposed-outlines/` subfolder — never into your live folder.
- **You** review and approve or reject each proposal inside the IdeaM app.
  There is deliberately **no approve tool over MCP** — an agent can only
  *withdraw* its own suggestion, never enact it.

The write layer is hard-guarded in code: any attempt to write a file that is
not a proposal sidecar or a `_proposed-outlines/` draft throws an error. Full
sidecar format spec: [PROPOSALS.md](./PROPOSALS.md).

**Back-compat note:** the write tool names (`create_node`, `update_node`,
`delete_node`, `move_node`, `add_tag`, `remove_tag`, `create_outline`) are
unchanged so existing client configs keep working — but their *semantics*
changed from "do it" to "propose it," and every response says so explicitly.

## Quick Start (5 minutes)

### 1. Install

```bash
cd mcp-server
npm install
npm run build
```

### 2. Configure Claude Desktop

Add this to your Claude Desktop config file:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "idiampro": {
      "command": "node",
      "args": ["/path/to/IdiamPro/mcp-server/dist/index.js"],
      "env": {}
    }
  }
}
```

Replace `/path/to/IdiamPro` with the actual path to your IdiamPro project.

### 3. Restart Claude Desktop

After saving the config, restart Claude Desktop. You should see "idiampro" in the MCP server list.

### 4. Try It

Ask Claude:
- "List my outlines"
- "Search for nodes about marketing"
- "Propose a new outline called Project Notes"
- "Export my Business Plan outline as markdown"
- "What change proposals are pending?"

## Tools Reference

### Read Operations (direct)
| Tool | Description |
|------|-------------|
| `list_outlines` | List all outlines with name, node count, and last modified |
| `get_outline` | Get the full structure of an outline |
| `get_node` | Get a specific node by ID |
| `search_nodes` | Full-text search across names and content |
| `list_tags` | List all unique tags |
| `filter_by_tags` | Find nodes matching any of the given tags |
| `export_outline` | Export an outline as Markdown or plain text |

### Write Operations (proposal-based — nothing changes until the owner approves in IdeaM)
| Tool | Records a proposal of kind |
|------|-------------|
| `create_node` | `add_node` |
| `update_node` | `rewrite_node` (with a `previous` snapshot for diffing) |
| `delete_node` | `delete_node` (includes descendant count) |
| `move_node` | `move_node` |
| `add_tag` / `remove_tag` | `rewrite_node` (tag metadata rewrite) |
| `create_outline` | `new_outline` (full draft saved in `_proposed-outlines/`) |

### Proposal Management
| Tool | Description |
|------|-------------|
| `list_proposals` | List proposals for one outline or all (filter by status) |
| `get_proposal` | Full details of one proposal by ID |
| `withdraw_proposal` | Retract a pending proposal (record kept as `withdrawn`). No approve tool exists — approval is the owner's, in IdeaM |

### Key Management
| Tool | Description |
|------|-------------|
| `generate_api_key` | Generate a new API key |
| `list_api_keys` | List all keys (without revealing values) |
| `revoke_api_key` | Revoke a key |

## Configuration

### Custom Outlines Directory

By default the server reads from `~/Documents/IDM Outlines/`. To use a different directory:

```json
{
  "mcpServers": {
    "idiampro": {
      "command": "node",
      "args": ["/path/to/mcp-server/dist/index.js", "--outlines-dir", "/custom/path"]
    }
  }
}
```

### Agent Label

Proposals are stamped with a source label so the owner can see who suggested
what. Set it per client with `--agent-label` (default: `external-ai-agent`):

```json
"args": ["/path/to/mcp-server/dist/index.js", "--agent-label", "claude-desktop"]
```

### Claude Code Integration

Add to your `.claude/settings.json`:

```json
{
  "mcpServers": {
    "idiampro": {
      "command": "node",
      "args": ["/path/to/IdiamPro/mcp-server/dist/index.js", "--agent-label", "claude-code"]
    }
  }
}
```

## Development

```bash
# Run in development mode (with hot reload)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run the proposal-model safety test (uses a temp outline dir; never touches real outlines)
node tests/proposal-model-test.js
```

## Architecture

- **Transport:** stdio (standard for local MCP servers)
- **Storage:** read-only file I/O on `.idm` JSON files; all mutations become proposals in `*.proposals.json` sidecars / `_proposed-outlines/` drafts (see [PROPOSALS.md](./PROPOSALS.md))
- **Auth:** SHA-256 hashed API keys stored in `~/.idiampro/api-keys.json`
- **Dependencies:** `@modelcontextprotocol/sdk`, `zod`

## Tier System

| Tier | API Calls/mo | AI Features | Price |
|------|-------------|-------------|-------|
| Free | 1,000 | — | $0 |
| Premium | 10,000 | Generate, Expand, Ingest | $19/mo |
| Pro | 50,000 | Unlimited AI | $49/mo |
| Enterprise | Unlimited | Everything + SSO | Contact us |

## License

Free tier tools: MIT License  
Premium/Pro/Enterprise tools: Proprietary (coming soon)
