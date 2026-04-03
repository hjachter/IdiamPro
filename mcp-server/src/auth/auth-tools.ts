import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiKeyManager } from "./api-key-manager.js";

/**
 * Register MCP tools for API key management.
 * These let users generate, list, and revoke keys from within Claude Desktop.
 */
export function registerAuthTools(
  server: McpServer,
  keyManager: ApiKeyManager
): void {
  server.tool(
    "generate_api_key",
    "Generate a new API key for IdiamPro MCP access. The raw key is only shown once.",
    {
      name: z.string().describe("A friendly name for this key (e.g. 'My Laptop')"),
    },
    async ({ name }) => {
      const { rawKey, keyId } = await keyManager.generateKey(name, "free");
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                keyId,
                name,
                tier: "free",
                rawKey,
                warning: "Save this key now — it cannot be retrieved later.",
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.tool(
    "list_api_keys",
    "List all API keys (active and revoked) without revealing the key values",
    {},
    async () => {
      const keys = await keyManager.listKeys();
      return {
        content: [{ type: "text", text: JSON.stringify(keys, null, 2) }],
      };
    }
  );

  server.tool(
    "revoke_api_key",
    "Revoke an API key so it can no longer be used",
    {
      keyId: z.string().describe("The key ID to revoke"),
    },
    async ({ keyId }) => {
      const success = await keyManager.revokeKey(keyId);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              success
                ? { success: true, keyId, message: "Key revoked" }
                : { success: false, error: "Key not found" }
            ),
          },
        ],
      };
    }
  );
}
