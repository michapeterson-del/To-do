// Einstiegspunkt: startet einen HTTP-Server, der das MCP-Protokoll ueber
// "Streamable HTTP" (POST /mcp) ausliefert. Dieses Transport-Format ist das,
// was Claude.ai fuer "Custom Connectors" (remote MCP-Server) erwartet.
//
// Es wird bewusst "stateless" betrieben: fuer jede Anfrage wird eine neue
// McpServer-Instanz samt Transport erzeugt und danach wieder verworfen. Das
// macht den Server robust gegenueber Neustarts/mehreren Instanzen (z.B. bei
// horizontaler Skalierung auf Render/Railway) und ist fuer die hier
// angebotenen zustandslosen LiveAgent-Tools voellig ausreichend.

import express, { type NextFunction, type Request, type Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { config } from "./config.js";
import { createLiveAgentMcpServer } from "./server.js";

const app = express();
app.use(express.json());

// Optionaler einfacher Schutz per Shared Secret. Claude.ai erlaubt bei
// Custom Connectors das Setzen eines Bearer-Tokens; wenn MCP_SHARED_SECRET
// gesetzt ist, wird jede Anfrage ohne passenden Header abgelehnt.
function checkSharedSecret(req: Request, res: Response, next: NextFunction) {
  if (!config.server.sharedSecret) {
    next();
    return;
  }

  const authHeader = req.header("authorization") ?? "";
  const expected = `Bearer ${config.server.sharedSecret}`;
  if (authHeader !== expected) {
    res.status(401).json({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Nicht autorisiert: fehlendes oder falsches Bearer-Token." },
      id: null,
    });
    return;
  }
  next();
}

// Health-Check fuer Hosting-Plattformen (Railway/Render) und zum manuellen
// Pruefen, ob der Server erreichbar ist.
app.get("/health", (_req, res) => {
  res.json({ status: "ok", server: "liveagent-mcp-server" });
});

app.post("/mcp", checkSharedSecret, async (req: Request, res: Response) => {
  try {
    const server = createLiveAgentMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    res.on("close", () => {
      transport.close();
      server.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("Fehler bei der Verarbeitung einer MCP-Anfrage:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Interner Serverfehler." },
        id: null,
      });
    }
  }
});

// GET/DELETE auf /mcp werden im stateless-Modus nicht unterstuetzt
// (es gibt keine Server-seitige Session, an die man anknuepfen koennte).
app.get("/mcp", (_req, res) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed. Dieser Server laeuft zustandslos (stateless)." },
    id: null,
  });
});

app.delete("/mcp", (_req, res) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed. Dieser Server laeuft zustandslos (stateless)." },
    id: null,
  });
});

app.listen(config.server.port, () => {
  console.log(`LiveAgent MCP-Server laeuft auf Port ${config.server.port}`);
  console.log(`MCP-Endpunkt: POST http://localhost:${config.server.port}/mcp`);
  console.log(`Health-Check: GET  http://localhost:${config.server.port}/health`);
});
