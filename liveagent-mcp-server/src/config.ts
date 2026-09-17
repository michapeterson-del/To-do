// Zentrale Konfiguration: liest die Umgebungsvariablen ein und prueft,
// dass die fuer den Betrieb notwendigen Werte vorhanden sind.

import "dotenv/config";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Umgebungsvariable "${name}" fehlt oder ist leer. Bitte in der .env-Datei ` +
        `(siehe .env.example) setzen, bevor der Server gestartet wird.`
    );
  }
  return value.trim();
}

export const config = {
  liveAgent: {
    apiKey: requireEnv("LIVEAGENT_API_KEY"),
    // Domain ohne Protokoll, z.B. "meinefirma.ladesk.com"
    domain: requireEnv("LIVEAGENT_DOMAIN").replace(/^https?:\/\//, "").replace(/\/+$/, ""),
  },
  server: {
    port: Number(process.env.PORT ?? 3000),
    // Optionales Shared Secret, das Clients per "Authorization: Bearer <secret>"
    // mitschicken muessen. Leer/undefiniert = keine zusaetzliche Absicherung
    // (nur fuer lokale Tests empfohlen).
    sharedSecret: process.env.MCP_SHARED_SECRET?.trim() || undefined,
  },
};

export const LIVEAGENT_BASE_URL = `https://${config.liveAgent.domain}/api/v3`;
