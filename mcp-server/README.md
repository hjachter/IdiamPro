# IdiamPro MCP Server

AI-powered outline management via the [Model Context Protocol](https://modelcontextprotocol.io). Lets AI assistants (Claude, etc.) read, write, search, and organize IdiamPro outlines programmatically.

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
- "Create a new outline called Project Notes"
- "Export my Business Plan outline as markdown"

## Tools Reference

### Read Operations
| Tool | Description |
|------|-------------|
| `list_outlines` | List all outlines with name, node count, and last modified |
| `get_outline` | Get the full structure of an outline |
| `get_node` | Get a specific node by ID |
| `search_nodes` | Full-text search across names and content |

### Write Operations
| Tool | Description |
|------|-------------|
| `create_outline` | Create a new outline from scratch |
| `create_node` | Add a new node under a parent |
| `update_node` | Update a node's name or content |
| `delete_node` | Remove a node and its descendants |
| `move_node` | Move a node to a new parent |

### Tag Operations
| Tool | Description |
|------|-------------|
| `add_tag` | Tag a node |
| `remove_tag` | Remove a tag from a node |
| `list_tags` | List all unique tags |
| `filter_by_tags` | Find nodes matching any of the given tags |

### Export
| Tool | Description |
|------|-------------|
| `export_outline` | Export an outline as Markdown or plain text |

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

### Claude Code Integration

Add to your `.claude/settings.json`:

```json
{
  "mcpServers": {
    "idiampro": {
      "command": "node",
      "args": ["/path/to/IdiamPro/mcp-server/dist/index.js"]
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
```

## Architecture

- **Transport:** stdio (standard for local MCP servers)
- **Storage:** Direct file I/O on `.idm` JSON files
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
