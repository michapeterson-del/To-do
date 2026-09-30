// Schickt einen Screenshot an die Claude API (Vision) und laesst daraus
// eine Aufgabe extrahieren. Nutzt die HTTP-API direkt statt des SDKs, um
// keine zusaetzliche Abhaengigkeit zu brauchen.

function buildPrompt(existingTasks) {
  const tasksForPrompt = existingTasks.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description || '',
    category: t.category,
    steps: Array.isArray(t.steps) ? t.steps.map((s) => s.text) : [],
  }));

  return `Du siehst einen Screenshot vom Bildschirm eines Nutzers bei der Arbeit.

Hier ist eine Liste seiner aktuell offenen Aufgaben (JSON):
${JSON.stringify(tasksForPrompt)}

Pruefe zuerst SEHR STRENG, ob der Screenshot zu einer dieser bestehenden
Aufgaben gehoert. Das ist NUR der Fall, wenn es sich um denselben konkreten
Vorgang handelt (z.B. dieselbe Bestellung, derselbe Termin, dasselbe
Gespraech mit derselben Person zum selben Thema) - nicht schon deshalb,
weil beide irgendwie geschaeftlich/aehnlich klingen oder zum selben groben
Themenbereich gehoeren. Im Zweifel IMMER action = "create" waehlen statt
eine thematisch nicht wirklich passende Aufgabe zu erweitern.

- Falls es WIRKLICH derselbe Vorgang ist UND der Screenshot neue
  Information zeigt, die die Aufgabe voranbringt (z.B. eine Antwort, ein
  neuer Status, ein naechster Schritt): action = "update". "update_note"
  ist dieser neue Schritt, kurz und konkret formuliert (wird als neuer
  Checklisten-Punkt an die Aufgabe angehaengt).
- Falls es derselbe Vorgang ist, aber der Screenshot zeigt nichts Neues
  (einfach dieselbe Sache nochmal): action = "duplicate".
- Falls der Screenshot zu KEINER bestehenden Aufgabe passt (der Normalfall
  bei einem neuen Thema): action = "create". Erkenne dann daraus EINE
  konkrete, umsetzbare neue Aufgabe.

Bei "create" oder wenn du unsicher bist, ob es eine bestehende Aufgabe ist,
entscheide bei der Kategorie:
- "today": eine konkrete Arbeits-Aufgabe fuer heute
- "process": eine uebergeordnete Aufgabe / ein Prozess, der optimiert oder
  verbessert werden soll
- "private": eine persoenliche/private Angelegenheit ohne Arbeitsbezug

WICHTIG fuer die Kategorie-Entscheidung: Waehle NUR dann "today" oder
"process", wenn der Screenshot einen klaren Arbeitsbezug zeigt - z.B. ein
Microsoft-Teams-Chat/Meeting, ein konkret genannter Hersteller/Lieferant/
Produktname, oder ein Gespraech das erkennbar mit Vertrieb, Tepto oder
Produktmanagement zu tun hat. Ist NICHTS davon erkennbar (z.B. ein
normaler WhatsApp-Chat oder sonstiges ohne erkennbaren Firmenbezug),
waehle IMMER "private" - auch wenn der Inhalt irgendwie nach einer
Aufgabe aussieht.

Bei "create" ist "description" PFLICHT und darf NIE leer bleiben, auch wenn
der Titel schon viel sagt: fasse dort konkret zusammen, was auf dem
Screenshot zu sehen ist (wer ist beteiligt, worum geht es genau, welche
Antwort/welcher naechste Schritt wird erwartet, ggf. Frist). Wiederhole
notfalls Inhalte aus dem Titel in eigenen Worten, aber liefere IMMER
mindestens einen vollstaendigen Satz.

Pruefe ausserdem, ob im Screenshot ein konkreter Termin mit Datum UND
Uhrzeit genannt wird (z.B. "Meeting Montag 14 Uhr", "Termin am 3.10. um
10:30"). Falls ja: "event_datetime" im Format JJJJ-MM-TTTHH:MM:00, sonst
leerer String. "event_title" ist dann ein kurzer Terminname, sonst leerer
String.

Antworte AUSSCHLIESSLICH mit einem JSON-Objekt in genau diesem Format, ohne
weiteren Text, ohne Markdown-Codeblock:
{"action": "create, update oder duplicate", "matched_task_id": "id der passenden Aufgabe oder null", "title": "kurzer Aufgabentitel (bei create)", "description": "1-2 Saetze Kontext (bei create)", "category": "today, process oder private (bei create)", "update_note": "neuer Schritt (nur bei update)", "event_datetime": "JJJJ-MM-TTTHH:MM:00 oder leerer String (bei create)", "event_title": "kurzer Terminname oder leerer String (bei create)"}`;
}

function parseTaskJson(raw, existingTasks) {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('Die KI-Antwort konnte nicht als Aufgabe interpretiert werden.');
  }

  const validIds = new Set(existingTasks.map((t) => t.id));
  let action = ['create', 'update', 'duplicate'].includes(parsed.action) ? parsed.action : 'create';
  let matchedTaskId = typeof parsed.matched_task_id === 'string' ? parsed.matched_task_id : null;

  if ((action === 'update' || action === 'duplicate') && !validIds.has(matchedTaskId)) {
    // Halluzinierte/unbekannte ID - sicherheitshalber als neue Aufgabe behandeln.
    action = 'create';
    matchedTaskId = null;
  }

  if (action === 'create') {
    const title = String(parsed.title || '').slice(0, 200).trim();
    if (!title) {
      throw new Error('Auf dem Screenshot wurde keine erkennbare Aufgabe gefunden.');
    }
    const description = String(parsed.description || '').slice(0, 1000).trim() || title;
    const category = ['process', 'private'].includes(parsed.category) ? parsed.category : 'today';
    const eventDatetime = String(parsed.event_datetime || '').trim();
    const eventTitle = String(parsed.event_title || '').slice(0, 200).trim();
    return {
      action: 'create',
      title,
      description,
      category,
      event_datetime: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(eventDatetime) ? eventDatetime : '',
      event_title: eventTitle || title,
    };
  }

  const matchedTask = existingTasks.find((t) => t.id === matchedTaskId);

  if (action === 'duplicate') {
    return { action: 'duplicate', matched_task_id: matchedTaskId, matched_task_title: matchedTask.title };
  }

  // action === 'update'
  const updateNote = String(parsed.update_note || '').slice(0, 500).trim();
  if (!updateNote) {
    // Ohne konkreten neuen Schritt ist "update" bedeutungslos.
    return { action: 'duplicate', matched_task_id: matchedTaskId, matched_task_title: matchedTask.title };
  }
  return {
    action: 'update',
    matched_task_id: matchedTaskId,
    matched_task_title: matchedTask.title,
    matched_task_steps: Array.isArray(matchedTask.steps) ? matchedTask.steps : [],
    update_note: updateNote,
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Anthropic antwortet bei kurzzeitiger Ueberlastung des eigenen Backends
// manchmal mit Status 503 oder 529 - hat nichts mit dem eigenen API-Key zu
// tun, ein kurzer Retry loest es meistens von selbst.
const RETRY_STATUS_CODES = [503, 529];
const RETRY_DELAYS_MS = [1500, 3000];

async function requestOnce(config, pngBase64, existingTasks) {
  return fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': config.anthropicApiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: config.claudeModel || 'claude-sonnet-5',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/png', data: pngBase64 } },
            { type: 'text', text: buildPrompt(existingTasks) },
          ],
        },
      ],
    }),
  });
}

async function analyzeScreenshot(config, pngBase64, existingTasks = []) {
  let res;
  for (let attempt = 0; ; attempt++) {
    res = await requestOnce(config, pngBase64, existingTasks);
    if (res.ok || !RETRY_STATUS_CODES.includes(res.status) || attempt >= RETRY_DELAYS_MS.length) break;
    await delay(RETRY_DELAYS_MS[attempt]);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Claude API Fehler (${res.status}): ${text || res.statusText}`);
  }

  const data = await res.json();
  const textBlock = Array.isArray(data.content) ? data.content.find((c) => c.type === 'text') : null;
  if (!textBlock) {
    throw new Error('Keine Textantwort von Claude erhalten.');
  }
  return parseTaskJson(textBlock.text, existingTasks);
}

module.exports = { analyzeScreenshot };
