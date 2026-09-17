// Duenner HTTP-Client fuer die LiveAgent REST API v3.
//
// WICHTIG ZU DEN FELDNAMEN/ENDPUNKTEN:
// Diese Implementierung folgt der oeffentlich dokumentierten Struktur der
// LiveAgent REST API v3 (https://developers.liveagent.com/). Da sich einzelne
// Feldnamen oder Enum-Werte je nach LiveAgent-Plan/Version leicht
// unterscheiden koennen, sind alle LiveAgent-spezifischen "magischen" Werte
// (Status-Codes, Nachrichtentypen, Kanaltyp) unten als Konstanten
// zusammengefasst. Falls ein Aufruf bei dir mit einem 4xx-Fehler
// fehlschlaegt, wird die komplette Fehlermeldung der LiveAgent-API
// durchgereicht (siehe LiveAgentApiError) - meist steht dort exakt, welches
// Feld angepasst werden muss.

import { LIVEAGENT_BASE_URL, config } from "./config.js";

// LiveAgent kennt mehr Ticket-Status als die drei vom Nutzer gewuenschten;
// wir bilden hier die gaengigen deutschen/englischen Bezeichnungen auf die
// von der API erwarteten Einzelbuchstaben-Codes ab.
export const TICKET_STATUS_MAP = {
  new: "N",
  open: "O",
  answered: "A",
  resolved: "R",
  closed: "C",
} as const;

export type TicketStatusKey = keyof typeof TICKET_STATUS_MAP;

// Kanaltyp fuer neu erstellte Tickets. "E" = E-Mail, das ist der sinnvollste
// Standard fuer programmatisch erstellte Tickets.
const DEFAULT_CHANNEL_TYPE = "E";
// Nachrichtenformat: "T" = Klartext (statt "H" = HTML).
const DEFAULT_MESSAGE_FORMAT = "T";
// Nachrichtentyp fuer die urspruengliche Ticket-Nachricht bzw. eine Antwort:
// "C" = vom Kunden kommend (Ticket-Eroeffnung), "M" = ausgehende
// Agent-Nachricht (Antwort an den Kunden).
const MESSAGE_TYPE_CUSTOMER = "C";
const MESSAGE_TYPE_AGENT_REPLY = "M";

export class LiveAgentApiError extends Error {
  readonly status: number;
  readonly endpoint: string;
  readonly responseBody: string;

  constructor(status: number, endpoint: string, responseBody: string) {
    super(
      `LiveAgent-API-Fehler bei ${endpoint}: HTTP ${status}. ` +
        `Antwort der API: ${responseBody || "(leerer Antwortkoerper)"}`
    );
    this.name = "LiveAgentApiError";
    this.status = status;
    this.endpoint = endpoint;
    this.responseBody = responseBody;
  }
}

type QueryValue = string | number | boolean | undefined;

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const url = new URL(`${LIVEAGENT_BASE_URL}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

async function request<T = unknown>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  options: { query?: Record<string, QueryValue>; body?: unknown } = {}
): Promise<T> {
  const url = buildUrl(path, options.query);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        apikey: config.liveAgent.apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch (networkError) {
    // Netzwerkfehler (DNS, Timeout, kein Internetzugriff, falsche Domain ...)
    const reason = networkError instanceof Error ? networkError.message : String(networkError);
    throw new Error(
      `Verbindung zu LiveAgent (${url}) fehlgeschlagen: ${reason}. ` +
        `Bitte pruefe LIVEAGENT_DOMAIN in der .env-Datei.`
    );
  }

  const rawBody = await response.text();

  if (!response.ok) {
    throw new LiveAgentApiError(response.status, `${method} ${path}`, rawBody);
  }

  if (!rawBody) {
    return undefined as T;
  }

  try {
    return JSON.parse(rawBody) as T;
  } catch {
    // Manche LiveAgent-Endpunkte antworten bei Erfolg mit reinem Text statt JSON.
    return rawBody as unknown as T;
  }
}

// ---------------------------------------------------------------------------
// Tickets
// ---------------------------------------------------------------------------

export interface CreateTicketInput {
  subject: string;
  message: string;
  customerEmail: string;
  departmentId?: string;
  tags?: string[];
}

export async function createTicket(input: CreateTicketInput) {
  return request("POST", "/tickets", {
    body: {
      channel_type: DEFAULT_CHANNEL_TYPE,
      subject: input.subject,
      department_id: input.departmentId,
      tags: input.tags ?? [],
      recipients: [{ email: input.customerEmail }],
      message: {
        format: DEFAULT_MESSAGE_FORMAT,
        type: MESSAGE_TYPE_CUSTOMER,
        message: input.message,
        sender: { email: input.customerEmail },
      },
    },
  });
}

export interface ListTicketsInput {
  status?: TicketStatusKey;
  customerEmail?: string;
  limit: number;
}

export async function listTickets(input: ListTicketsInput) {
  // LiveAgent bietet fuer die Volltextsuche (u.a. ueber Kunden-E-Mail) den
  // Endpunkt "/tickets/search", waehrend eine reine Status-Filterung ueber
  // den generischen Filter-Mechanismus von "/tickets" laeuft. Ist eine
  // Kunden-E-Mail angegeben, nutzen wir die Suche und filtern das Ergebnis
  // bei Bedarf clientseitig zusaetzlich nach Status.
  if (input.customerEmail) {
    const results = await request<any[]>("GET", "/tickets/search", {
      query: { q: input.customerEmail, _perPage: input.limit },
    });
    const list = Array.isArray(results) ? results : [];
    const statusCode = input.status ? TICKET_STATUS_MAP[input.status] : undefined;
    const filtered = statusCode ? list.filter((t) => t?.status === statusCode) : list;
    return filtered.slice(0, input.limit);
  }

  const query: Record<string, QueryValue> = { _perPage: input.limit, _page: 1 };
  if (input.status) {
    query._filters = JSON.stringify([["status", "=", TICKET_STATUS_MAP[input.status]]]);
  }
  return request("GET", "/tickets", { query });
}

export async function getTicket(ticketId: string) {
  const ticket = await request("GET", `/tickets/${encodeURIComponent(ticketId)}`);
  let messages: unknown;
  try {
    messages = await request("GET", `/tickets/${encodeURIComponent(ticketId)}/messages`);
  } catch (error) {
    // Wenn die Nachrichten nicht geladen werden koennen, geben wir trotzdem
    // die Ticket-Stammdaten zurueck und haengen die Fehlermeldung an, statt
    // den kompletten Aufruf scheitern zu lassen.
    messages = { error: error instanceof Error ? error.message : String(error) };
  }
  return { ticket, messages };
}

export async function replyToTicket(ticketId: string, message: string) {
  return request("POST", `/tickets/${encodeURIComponent(ticketId)}/messages`, {
    body: {
      format: DEFAULT_MESSAGE_FORMAT,
      type: MESSAGE_TYPE_AGENT_REPLY,
      message,
    },
  });
}

export async function updateTicketStatus(ticketId: string, status: TicketStatusKey) {
  return request("PUT", `/tickets/${encodeURIComponent(ticketId)}`, {
    body: { status: TICKET_STATUS_MAP[status] },
  });
}

export async function addTagToTicket(ticketId: string, tag: string) {
  return request("POST", `/tickets/${encodeURIComponent(ticketId)}/tags`, {
    body: { tags: [tag] },
  });
}

// ---------------------------------------------------------------------------
// Kontakte / Kunden
// ---------------------------------------------------------------------------

export async function getCustomerByEmail(email: string) {
  // LiveAgent loest Kontakte ueber die E-Mail-Adresse via
  // GET /contacts/emails/{email} auf. Je nach Version liefert dieser
  // Endpunkt entweder direkt den vollstaendigen Kontakt oder nur eine
  // Kontakt-ID zurueck - wir behandeln daher beide Faelle.
  const lookup = await request<any>("GET", `/contacts/emails/${encodeURIComponent(email)}`);

  if (lookup && typeof lookup === "object" && "id" in lookup && !("emails" in lookup)) {
    return request("GET", `/contacts/${encodeURIComponent(String((lookup as any).id))}`);
  }

  return lookup;
}
