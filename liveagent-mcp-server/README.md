# LiveAgent MCP-Server

Ein MCP-Server (Model Context Protocol), der die LiveAgent-Kundensupport-API
als Werkzeuge (Tools) fuer Claude bereitstellt. Der Server laeuft als
HTTP-Dienst ("Streamable HTTP"-Transport) und kann deshalb als **Custom
Connector** in [Claude.ai](https://claude.ai) eingebunden werden.

## Wichtiger Hinweis zur LiveAgent-API

Die Implementierung in `src/liveagentClient.ts` folgt der oeffentlich
dokumentierten Struktur der [LiveAgent REST API v3](https://developers.liveagent.com/).
Einzelne Feldnamen und Enum-Werte (z.B. Status-Codes, Nachrichtentypen)
koennen je nach LiveAgent-Plan/-Version leicht abweichen. Alle
LiveAgent-spezifischen Konstanten sind daher zentral am Anfang von
`src/liveagentClient.ts` gesammelt, sodass sie sich bei Bedarf leicht
anpassen lassen. Schlaegt ein API-Aufruf fehl, wird die vollstaendige
Original-Fehlermeldung von LiveAgent an Claude zurueckgegeben - dort steht
in der Regel bereits, welches Feld korrigiert werden muss.

## Bereitgestellte Tools

| Tool | Beschreibung |
|---|---|
| `create_ticket` | Erstellt ein neues Ticket (Betreff, Nachricht, Kunden-E-Mail, optional Abteilung/Tags) |
| `list_tickets` | Listet Tickets, filterbar nach Status, Kunden-E-Mail, mit Limit |
| `get_ticket` | Holt ein Ticket inkl. vollstaendigem Nachrichtenverlauf |
| `reply_to_ticket` | Schreibt eine Antwort in ein bestehendes Ticket |
| `update_ticket_status` | Aendert den Status eines Tickets (new/open/answered/resolved/closed) |
| `add_tag_to_ticket` | Fuegt einem Ticket ein Tag hinzu |
| `get_customer` | Holt Kundendaten anhand der E-Mail-Adresse |

## 1. Setup

### Voraussetzungen

- Node.js 18 oder neuer
- Ein LiveAgent-Konto mit API-Zugriff

### API-Key besorgen

In LiveAgent unter **Konfiguration -> System -> API** findest du deinen
API-Schluessel. Deine Domain ist die Subdomain, unter der dein LiveAgent
laeuft, z.B. `meinefirma.ladesk.com`.

### Installation

```bash
cd liveagent-mcp-server
npm install
cp .env.example .env
```

Trage in `.env` deine Zugangsdaten ein:

```env
LIVEAGENT_API_KEY=dein-api-key
LIVEAGENT_DOMAIN=meinefirma.ladesk.com
PORT=3000
MCP_SHARED_SECRET=
```

`MCP_SHARED_SECRET` ist optional, aber empfohlen, sobald der Server
oeffentlich erreichbar ist (siehe Abschnitt 3). Ist es gesetzt, muss jede
Anfrage den Header `Authorization: Bearer <MCP_SHARED_SECRET>` mitschicken.

### Bauen und starten

```bash
npm run build
npm start
```

Der Server laeuft danach auf `http://localhost:3000` mit:

- `GET /health` - einfacher Health-Check
- `POST /mcp` - der eigentliche MCP-Endpunkt

Fuer die Entwicklung mit automatischem Neustart bei Aenderungen:

```bash
npm run dev
```

## 2. Lokal testen

### Variante A: MCP Inspector (empfohlen)

Das offizielle Debugging-Tool fuer MCP-Server:

```bash
npm run build
npm run inspector
```

Es oeffnet eine Weboberflaeche, in der du dich mit
`http://localhost:3000/mcp` (Transport: "Streamable HTTP") verbinden, die
Tools einsehen und einzeln mit Testdaten aufrufen kannst - inklusive der
zurueckgegebenen Fehlermeldungen, falls z.B. ein Feld nicht zur API deiner
LiveAgent-Instanz passt.

### Variante B: Manuell per curl

Health-Check:

```bash
curl http://localhost:3000/health
```

MCP-Handshake (initialize):

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
```

Ein Tool aufrufen, z.B. `list_tickets`:

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_tickets","arguments":{"status":"open","limit":5}}}'
```

Falls `MCP_SHARED_SECRET` gesetzt ist, ergaenze bei jedem Aufruf:

```bash
-H "Authorization: Bearer dein-shared-secret"
```

## 3. Als Custom Connector in Claude.ai einbinden

Claude.ai Custom Connectors benoetigen eine **oeffentlich erreichbare
HTTPS-URL** - `localhost` funktioniert dafuer nicht. Der Server muss also
zuerst gehostet werden, z.B. kostenguenstig auf Railway oder Render.

### Deployment auf Railway

1. Auf [railway.app](https://railway.app) einloggen und **New Project ->
   Deploy from GitHub repo** waehlen, dann dieses Repository auswaehlen.
2. Als **Root Directory** `liveagent-mcp-server` angeben (falls Railway
   danach fragt bzw. unter Settings -> "Root Directory" nachtragen).
3. Unter **Variables** die Umgebungsvariablen setzen:
   - `LIVEAGENT_API_KEY`
   - `LIVEAGENT_DOMAIN`
   - `MCP_SHARED_SECRET` (empfohlen)
4. Build-Command: `npm install && npm run build`
   Start-Command: `npm start`
   (Railway erkennt dies meist automatisch anhand von `package.json`.)
5. Railway generiert automatisch eine oeffentliche Domain unter
   **Settings -> Networking -> Generate Domain**, z.B.
   `https://dein-projekt.up.railway.app`.

### Deployment auf Render

1. Auf [render.com](https://render.com) **New -> Web Service** waehlen und
   dieses Repository verbinden.
2. **Root Directory**: `liveagent-mcp-server`
3. **Build Command**: `npm install && npm run build`
4. **Start Command**: `npm start`
5. Unter **Environment** die gleichen Variablen wie oben setzen
   (`LIVEAGENT_API_KEY`, `LIVEAGENT_DOMAIN`, optional `MCP_SHARED_SECRET`).
6. Render vergibt automatisch eine oeffentliche URL, z.B.
   `https://dein-projekt.onrender.com`.

Beide Plattformen setzen automatisch die Umgebungsvariable `PORT` - der
Server liest sie bereits korrekt aus (`config.ts`), du musst sie also nicht
manuell setzen.

### Connector in Claude.ai anlegen

1. In Claude.ai zu **Einstellungen -> Connectors** (bzw. "Connectoren")
   gehen.
2. **Custom Connector hinzufuegen** waehlen.
3. Als URL den MCP-Endpunkt deiner deployten Instanz eintragen, z.B.:

   ```
   https://dein-projekt.up.railway.app/mcp
   ```

4. Falls du `MCP_SHARED_SECRET` gesetzt hast, hinterlege es dort, wo
   Claude.ai fuer Custom Connectors ein Zugriffs-Token/einen Header abfragt
   (bitte die aktuelle Claude.ai-Oberflaeche pruefen, da sich diese
   Konfigurationsmoeglichkeiten weiterentwickeln).
5. Speichern - Claude.ai fuehrt automatisch den `initialize`-Handshake
   durch und zeigt anschliessend die sieben LiveAgent-Tools an.
6. In einem Chat kannst du den Connector aktivieren und z.B. schreiben:
   *"Liste alle offenen LiveAgent-Tickets von kunde@example.com auf."*

### Sicherheitshinweis

Ohne `MCP_SHARED_SECRET` kann **jeder, der die URL kennt**, ueber deinen
Server auf dein LiveAgent-Konto zugreifen (Tickets lesen, erstellen,
beantworten). Setze das Shared Secret, sobald der Server oeffentlich
erreichbar ist, und behandle die URL sowie das Secret wie ein Passwort.

## Architektur

```
src/
  config.ts           Liest und validiert Umgebungsvariablen
  liveagentClient.ts   HTTP-Client fuer die LiveAgent REST API v3
  tools.ts             Definition und Fehlerbehandlung der 7 MCP-Tools
  server.ts            Erstellt eine McpServer-Instanz mit allen Tools
  index.ts             Express-HTTP-Server mit Streamable-HTTP-Transport
```

Der Server arbeitet zustandslos ("stateless"): Fuer jede eingehende
MCP-Anfrage wird eine neue `McpServer`-Instanz erzeugt und nach der
Antwort wieder verworfen. Das passt zu den hier angebotenen Tools (keine
serverseitigen Sitzungen noetig) und macht den Betrieb auf Plattformen wie
Railway/Render robuster gegenueber Neustarts und mehreren Instanzen.
