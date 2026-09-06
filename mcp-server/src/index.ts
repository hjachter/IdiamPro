#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { OutlineStorage } from "./storage/outline-storage.js";
import { ProposalStore } from "./storage/proposal-store.js";
import { registerOutlineTools } from "./tools/outline-tools.js";
import { ApiKeyManager } from "./auth/api-key-manager.js";
import { registerAuthTools } from "./auth/auth-tools.js";
import { homedir } from "os";
import { join } from "path";

const DEFAULT_OUTLINES_DIR = join(homedir(), "Documents", "IDM Outlines");

function parseArgs(): { outlinesDir: string; agentLabel: string } {
  const args = process.argv.slice(2);
  let outlinesDir = DEFAULT_OUTLINES_DIR;
  let agentLabel = "external-ai-agent";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--outlines-dir" && args[i + 1]) {
      outlinesDir = args[i + 1];
      i++;
    } else if (args[i] === "--agent-label" && args[i + 1]) {
      agentLabel = args[i + 1];
      i++;
    }
  }

  return { outlinesDir, agentLabel };
}

async function main() {
  const { outlinesDir, agentLabel } = parseArgs();

  console.error(`[idiampro-mcp] Starting server v0.2.0 (proposal-based trust model)`);
  console.error(`[idiampro-mcp] Outlines directory: ${outlinesDir} (outlines are READ-ONLY; changes become proposals)`);
  console.error(`[idiampro-mcp] Agent label: ${agentLabel}`);

  const server = new McpServer({
    name: "idiampro-mcp",
    version: "0.2.0",
  });

  const storage = new OutlineStorage(outlinesDir);
  const proposals = new ProposalStore(outlinesDir);
  const keyManager = new ApiKeyManager();

  registerOutlineTools(server, storage, proposals, agentLabel);
  registerAuthTools(server, keyManager);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(`[idiampro-mcp] Server connected via stdio`);
  console.error(`[idiampro-mcp] Tools registered: 20 (14 outline + 3 proposal + 3 auth)`);
}

main().catch((error) => {
  console.error("[idiampro-mcp] Fatal error:", error);
  process.exit(1);
});
