// Baut eine frisch konfigurierte MCP-Server-Instanz mit allen registrierten
// LiveAgent-Tools. Wird pro eingehender HTTP-Anfrage neu aufgerufen (siehe
// index.ts), damit jede Anfrage sauber isoliert verarbeitet wird
// (empfohlenes "stateless"-Muster fuer das Streamable-HTTP-Transport).

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerLiveAgentTools } from "./tools.js";

export function createLiveAgentMcpServer(): McpServer {
  const server = new McpServer({
    name: "liveagent-mcp-server",
    version: "1.0.0",
  });

  registerLiveAgentTools(server);

  return server;
}
