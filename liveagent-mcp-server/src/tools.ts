// Registriert alle LiveAgent-Werkzeuge (Tools) am MCP-Server.
// Jede Tool-Beschreibung ist bewusst ausfuehrlich formuliert, damit Claude
// zuverlaessig erkennt, wann welches Tool sinnvoll ist.

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  LiveAgentApiError,
  addTagToTicket,
  createTicket,
  getCustomerByEmail,
  getTicket,
  listTickets,
  replyToTicket,
  updateTicketStatus,
} from "./liveagentClient.js";

const STATUS_ENUM = ["new", "open", "answered", "resolved", "closed"] as const;

// Einheitliche Fehlerbehandlung: Jeder Tool-Aufruf laeuft durch diese
// Hilfsfunktion, damit Fehler dem Nutzer immer als klare, lesbare
// Text-Antwort angezeigt werden (statt als kryptischer Server-Fehler).
async function runTool(fn: () => Promise<unknown>) {
  try {
    const result = await fn();
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    const message =
      error instanceof LiveAgentApiError
        ? error.message
        : error instanceof Error
          ? `Unerwarteter Fehler: ${error.message}`
          : `Unerwarteter Fehler: ${String(error)}`;

    return {
      content: [{ type: "text" as const, text: message }],
      isError: true,
    };
  }
}

export function registerLiveAgentTools(server: McpServer): void {
  server.registerTool(
    "create_ticket",
    {
      title: "LiveAgent-Ticket erstellen",
      description:
        "Erstellt ein neues Support-Ticket in LiveAgent fuer einen Kunden. " +
        "Nutze dieses Tool, wenn ein komplett neues Anliegen eines Kunden " +
        "als Ticket erfasst werden soll (z.B. eine neue Support-Anfrage per " +
        "E-Mail nachbilden). Gib immer eine aussagekraeftige Betreffzeile " +
        "und den vollstaendigen Nachrichtentext an.",
      inputSchema: {
        subject: z.string().min(1).describe("Betreff/Titel des Tickets"),
        message: z.string().min(1).describe("Inhalt der ersten Nachricht des Tickets"),
        customer_email: z
          .string()
          .email()
          .describe("E-Mail-Adresse des Kunden, fuer den das Ticket angelegt wird"),
        department_id: z
          .string()
          .optional()
          .describe("Optionale ID der LiveAgent-Abteilung, der das Ticket zugeordnet werden soll"),
        tags: z
          .array(z.string())
          .optional()
          .describe("Optionale Liste von Tags, die dem Ticket direkt bei Erstellung zugewiesen werden"),
      },
    },
    async ({ subject, message, customer_email, department_id, tags }) =>
      runTool(() =>
        createTicket({
          subject,
          message,
          customerEmail: customer_email,
          departmentId: department_id,
          tags,
        })
      )
  );

  server.registerTool(
    "list_tickets",
    {
      title: "LiveAgent-Tickets auflisten",
      description:
        "Listet bestehende LiveAgent-Tickets auf. Kann nach Status " +
        "(new/open/answered/resolved/closed) und/oder nach der E-Mail-Adresse " +
        "eines Kunden gefiltert werden. Nutze dieses Tool, um dir einen " +
        "Ueberblick ueber offene Anfragen zu verschaffen oder alle Tickets " +
        "eines bestimmten Kunden zu finden, bevor du z.B. mit get_ticket " +
        "ins Detail gehst.",
      inputSchema: {
        status: z
          .enum(STATUS_ENUM)
          .optional()
          .describe("Nach Ticket-Status filtern (new, open, answered, resolved, closed)"),
        customer_email: z
          .string()
          .email()
          .optional()
          .describe("Nur Tickets dieses Kunden anzeigen"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .default(20)
          .describe("Maximale Anzahl zurueckgegebener Tickets (Standard: 20)"),
      },
    },
    async ({ status, customer_email, limit }) =>
      runTool(() => listTickets({ status, customerEmail: customer_email, limit: limit ?? 20 }))
  );

  server.registerTool(
    "get_ticket",
    {
      title: "LiveAgent-Ticket-Details abrufen",
      description:
        "Holt ein einzelnes LiveAgent-Ticket anhand seiner ID inklusive des " +
        "vollstaendigen Nachrichtenverlaufs. Nutze dieses Tool, wenn du den " +
        "genauen Inhalt und die Historie eines bestimmten Tickets kennen " +
        "musst, z.B. bevor du eine Antwort formulierst.",
      inputSchema: {
        ticket_id: z.string().min(1).describe("Die ID des LiveAgent-Tickets"),
      },
    },
    async ({ ticket_id }) => runTool(() => getTicket(ticket_id))
  );

  server.registerTool(
    "reply_to_ticket",
    {
      title: "Auf LiveAgent-Ticket antworten",
      description:
        "Fuegt einem bestehenden LiveAgent-Ticket eine neue Antwort-Nachricht " +
        "hinzu, die an den Kunden gesendet wird. Nutze dieses Tool, um auf " +
        "eine Kundenanfrage in einem bereits existierenden Ticket zu " +
        "reagieren. Verwechsle es nicht mit create_ticket, das ein " +
        "komplett neues Ticket anlegt.",
      inputSchema: {
        ticket_id: z.string().min(1).describe("Die ID des Tickets, auf das geantwortet werden soll"),
        message: z.string().min(1).describe("Der Text der Antwort an den Kunden"),
      },
    },
    async ({ ticket_id, message }) => runTool(() => replyToTicket(ticket_id, message))
  );

  server.registerTool(
    "update_ticket_status",
    {
      title: "LiveAgent-Ticket-Status aendern",
      description:
        "Aendert den Status eines LiveAgent-Tickets, z.B. um ein Ticket als " +
        "geloest (resolved) oder geschlossen (closed) zu markieren, oder es " +
        "wieder zu oeffnen (open). Nutze dieses Tool nach Abschluss einer " +
        "Bearbeitung oder wenn sich der Bearbeitungsstand eines Tickets " +
        "aendert.",
      inputSchema: {
        ticket_id: z.string().min(1).describe("Die ID des Tickets, dessen Status geaendert werden soll"),
        status: z.enum(STATUS_ENUM).describe("Der neue Status des Tickets"),
      },
    },
    async ({ ticket_id, status }) => runTool(() => updateTicketStatus(ticket_id, status))
  );

  server.registerTool(
    "add_tag_to_ticket",
    {
      title: "Tag zu LiveAgent-Ticket hinzufuegen",
      description:
        "Fuegt einem bestehenden LiveAgent-Ticket ein einzelnes Tag/Label " +
        "hinzu, ohne vorhandene Tags zu entfernen. Nutze dieses Tool, um " +
        "Tickets zu kategorisieren (z.B. 'dringend', 'rechnung', 'bug').",
      inputSchema: {
        ticket_id: z.string().min(1).describe("Die ID des Tickets, dem ein Tag hinzugefuegt werden soll"),
        tag: z.string().min(1).describe("Der Name des Tags, das hinzugefuegt werden soll"),
      },
    },
    async ({ ticket_id, tag }) => runTool(() => addTagToTicket(ticket_id, tag))
  );

  server.registerTool(
    "get_customer",
    {
      title: "LiveAgent-Kundendaten abrufen",
      description:
        "Holt die in LiveAgent hinterlegten Kontaktdaten eines Kunden " +
        "anhand seiner E-Mail-Adresse. Nutze dieses Tool, um Hintergrund- " +
        "informationen ueber einen Kunden zu erhalten, z.B. bevor du ein " +
        "Ticket fuer ihn erstellst oder beantwortest.",
      inputSchema: {
        email: z.string().email().describe("E-Mail-Adresse des gesuchten Kunden"),
      },
    },
    async ({ email }) => runTool(() => getCustomerByEmail(email))
  );
}
