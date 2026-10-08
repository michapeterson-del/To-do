// Aufgabe aus Screenshot erfassen (Scriptable)
//
// Ersetzt fast den ganzen bisherigen iOS-Kurzbefehl - der Kurzbefehl macht
// nur noch den Screenshot (das darf nur Shortcuts selbst, keine App wie
// Scriptable), den Rest (Claude-Analyse, Speichern) macht dieses Script.
//
// Das Script nimmt IMMER das neueste Bild aus der Fotos-App - die direkte
// Bild-Uebergabe von Kurzbefehle an Scriptable (per "Eingabe") ist auf
// manchen Geraeten unzuverlaessig und liefert dann ein leeres/altes Bild.
// Deshalb muss der Kurzbefehl den Screenshot explizit in die Fotos-App
// sichern (siehe Schritt 4b unten) - dann ist er garantiert der neueste.
// Das Script loescht den Screenshot danach selbst wieder aus Fotos, damit
// sich dort nichts ansammelt - dafuer braucht der Kurzbefehl keinen
// eigenen Loesch-Schritt.
//
// Einrichtung:
// 1. "Scriptable" App aus dem App Store laden (kostenlos) - falls du sie
//    fuer das Home-Widget schon hast, ist das dieselbe App.
// 2. Neues Script anlegen, diesen ganzen Text reinkopieren.
// 3. Unten bei SUPABASE_URL, SUPABASE_ANON_KEY und ANTHROPIC_API_KEY
//    deine eigenen Werte eintragen.
// 4. In der Kurzbefehle-App: neuer Kurzbefehl mit GENAU 3 Aktionen:
//    a) "Bildschirmfoto aufnehmen"
//    b) "Bild im Fotoalbum sichern" (bzw. "Save to Photo Album") -> als
//       Eingabe das Bildschirmfoto aus Schritt a) waehlen
//    c) "Scriptable ausfuehren" -> dieses Script auswaehlen (kein
//       Loesch-Schritt noetig, macht das Script selbst)
// 5. Einstellungen -> Action-Taste -> "Kurzbefehl" -> den Kurzbefehl aus
//    Schritt 4 auswaehlen.
// 6. Testen: in einer App (z.B. WhatsApp) Action-Taste druecken.
//
// Zum Testen direkt in Scriptable (Play-Button, ohne Kurzbefehl): nimmt
// ebenfalls das neueste Fotos-App-Bild (fragt einmalig nach Fotos-Zugriff) -
// dafuer vorher selbst einen Screenshot machen.

const SUPABASE_URL = "https://DEINE-PROJEKT-ID.supabase.co";
const SUPABASE_ANON_KEY = "DEIN-ANON-KEY";
const ANTHROPIC_API_KEY = "DEIN-ANTHROPIC-KEY";
const CLAUDE_MODEL = "claude-sonnet-5";

function supabaseRequest(method, pathAndQuery, body) {
  const req = new Request(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`);
  req.method = method;
  req.headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
  if (body !== undefined) req.body = JSON.stringify(body);
  return req;
}

async function fetchOpenTasks() {
  // Limit + order: haelt die Anfrage an Supabase UND den Prompt an Claude
  // klein, auch wenn viele Aufgaben offen sind - wichtig fuers Zeitlimit.
  const req = supabaseRequest(
    "GET",
    "tasks?select=id,title,description,category,steps&status=eq.open&order=created_at.desc&limit=20"
  );
  const raw = await req.loadString();
  const status = req.response ? req.response.statusCode : "?";
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Supabase-Antwort (Status ${status}) ist kein JSON: ${raw.slice(0, 300)}`);
  }
  if (!Array.isArray(data)) {
    throw new Error(`Supabase-Fehler (Status ${status}): ${data.message || JSON.stringify(data).slice(0, 300)}`);
  }
  return data;
}

function buildPrompt(existingTasks) {
  const tasksForPrompt = existingTasks.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description || "",
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
der Titel schon viel sagt. Halte sie KURZ und STICHWORTARTIG, keine
ausformulierten Saetze: am besten 2-4 knappe Stichpunkte, getrennt durch
Zeilenumbrueche, jeweils mit "- " am Anfang, jeweils nur 2-6 Woerter.
Inhalt je nach Platz: wer ist beteiligt, worum geht es genau, welche
Antwort/welcher naechste Schritt wird erwartet, ggf. Frist.

Erkennst du im Screenshot einen wiederkehrenden Geschaeftspartner/
Lieferanten/Kunden (z.B. Fronius, EcoFlow, Tepto) oder ein Thema, das
typischerweise in einem regelmaessigen Meeting dazu besprochen wird,
ergaenze die description um einen zusaetzlichen Stichpunkt wie "- Fuer
naechstes [Name]-Meeting vormerken". Nur wenn das wirklich naheliegend
ist, sonst weglassen - keine echte Kalenderanbindung vorhanden, das ist
nur eine inhaltliche Vermutung.

Pruefe ausserdem, ob im Screenshot ein konkreter Termin mit Datum UND
Uhrzeit genannt wird (z.B. "Meeting Montag 14 Uhr", "Termin am 3.10. um
10:30"). Falls ja: "event_datetime" im Format JJJJ-MM-TTTHH:MM:00, sonst
leerer String. "event_title" ist dann ein kurzer Terminname, sonst leerer
String.

Pruefe ausserdem bei "create", ob der Screenshot auf eine WIEDERKEHRENDE
Aufgabe hindeutet, z.B. "jeden Montag", "taeglich", "woechentliches
Meeting", "jeden 1. im Monat", "monatliche Abrechnung". Falls ja:
"recurrence" = "daily", "weekly" oder "monthly" je nach Turnus, sonst
"recurrence" = "none". Nur falls "monthly" UND ein konkreter Tag des
Monats erkennbar ist (z.B. "jeden 15."): "recurrence_day" = diese Zahl
(1-31) als Zahl, sonst "recurrence_day" = null. Im Zweifel IMMER
"recurrence" = "none" waehlen statt zu raten.

Antworte AUSSCHLIESSLICH mit einem JSON-Objekt in genau diesem Format, ohne
weiteren Text, ohne Markdown-Codeblock:
{"action": "create, update oder duplicate", "matched_task_id": "id der passenden Aufgabe oder null", "title": "kurzer Aufgabentitel (bei create)", "description": "1-2 Saetze Kontext (bei create)", "category": "today, process oder private (bei create)", "update_note": "neuer Schritt (nur bei update)", "event_datetime": "JJJJ-MM-TTTHH:MM:00 oder leerer String (bei create)", "event_title": "kurzer Terminname oder leerer String (bei create)", "recurrence": "none, daily, weekly oder monthly (bei create)", "recurrence_day": "Zahl 1-31 oder null (nur bei monthly mit erkennbarem Tag)"}`;
}

function delay(ms) {
  // Scriptable kennt kein globales setTimeout - warten per Busy-Wait
  // (nur kurze Wartezeiten von 1.5-3s, unkritisch).
  const start = Date.now();
  while (Date.now() - start < ms) {
    /* warten */
  }
}

// Anthropic antwortet bei kurzzeitiger Ueberlastung des eigenen Backends
// manchmal mit Status 503 oder 529 (teils sogar als Klartext statt JSON,
// z.B. "credential validation failed"). Das hat nichts mit dem eigenen
// API-Key zu tun - ein kurzer Retry loest es meistens von selbst.
const RETRY_STATUS_CODES = [503, 529];
const RETRY_DELAYS_MS = [1500, 3000];

async function requestOnce(base64Png, existingTasks) {
  const req = new Request("https://api.anthropic.com/v1/messages");
  // Bewusst knapp: die gesamte "Run Script"-Aktion hat in Kurzbefehle ein
  // eigenes, hartes Zeitlimit (iOS-Meldung "Der Vorgang dauerte zu lange").
  // Das gilt fuer den KOMPLETTEN Scriptablauf (Supabase + Claude +
  // Speichern), nicht nur fuer diese eine Anfrage - je knapper wir hier
  // sind, desto eher passt der gesamte Ablauf noch darunter.
  req.timeoutInterval = 15;
  req.method = "POST";
  req.headers = {
    "x-api-key": ANTHROPIC_API_KEY,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
  };
  req.body = JSON.stringify({
    model: CLAUDE_MODEL,
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/png", data: base64Png } },
          { type: "text", text: buildPrompt(existingTasks) },
        ],
      },
    ],
  });
  const raw = await req.loadString();
  const status = req.response ? req.response.statusCode : "?";
  return { raw, status };
}

async function analyzeScreenshot(base64Png, existingTasks) {
  // Bei einer eigenen Zeitueberschreitung (networkError) bewusst KEIN
  // Retry mehr: das wuerde die Gesamtlaufzeit verdoppeln und das harte
  // iOS-Zeitlimit der gesamten "Run Script"-Aktion erst recht reissen.
  // Nur bei 503/529 (Server antwortet schnell mit "ueberlastet") lohnt
  // sich ein kurzer erneuter Versuch, weil der kaum Zeit kostet.
  let raw, status;
  for (let attempt = 0; ; attempt++) {
    ({ raw, status } = await requestOnce(base64Png, existingTasks));
    if (!RETRY_STATUS_CODES.includes(status) || attempt >= RETRY_DELAYS_MS.length) break;
    await delay(RETRY_DELAYS_MS[attempt]);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Claude-API Antwort (Status ${status}) ist kein JSON: ${raw.slice(0, 300)}`);
  }
  if (data.error) {
    throw new Error(`Claude-API Fehler (Status ${status}): ${data.error.message || JSON.stringify(data.error)}`);
  }
  const textBlock = (data.content || []).find((c) => c.type === "text");
  if (!textBlock) throw new Error(`Keine Textantwort von Claude erhalten. Rohantwort: ${raw.slice(0, 300)}`);
  const cleaned = textBlock.text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`Claudes Text ist kein gueltiges JSON: ${cleaned.slice(0, 300)}`);
  }
}

// Verkleinert ein Bild auf maximal maxDimension (laengere Seite), falls
// noetig. Moderne iPhone-Screenshots sind in voller Aufloesung teils zu
// gross fuer die Claude-API (Fehler 413 "Request exceeds the maximum
// size") - 1568px ist ausserdem die Groesse, auf die Claude Bilder intern
// sowieso herunterskaliert, verkleinern verliert also keine erkennbaren
// Details.
function resizeImageIfNeeded(image, maxDimension) {
  const { width, height } = image.size;
  if (Math.max(width, height) <= maxDimension) return image;
  const scale = maxDimension / Math.max(width, height);
  const newSize = new Size(Math.round(width * scale), Math.round(height * scale));
  const ctx = new DrawContext();
  ctx.size = newSize;
  ctx.respectScreenScale = false;
  ctx.drawImageInRect(image, new Rect(0, 0, newSize.width, newSize.height));
  return ctx.getImage();
}

async function showAlert(title, message) {
  // Ueber die Action-Taste/Siri sind interaktive Alerts nicht erlaubt -
  // eine Benachrichtigung funktioniert dagegen ueberall.
  const n = new Notification();
  n.title = title;
  if (message) n.body = message;
  await n.schedule();
}

async function main() {
  // Absichtlich "latestPhotos" statt "latestScreenshots": ein per
  // Kurzbefehl ("Bild im Fotoalbum sichern") neu gespeichertes Bild traegt
  // nicht zuverlaessig das spezielle iOS-Merkmal "ist ein Systemscreenshot" -
  // "latestScreenshots" wuerde es dann ignorieren und stattdessen ein altes,
  // echtes Screenshot finden (und das auch faelschlich loeschen).
  const photos = await Photos.latestPhotos(1);
  if (!photos.length) {
    await showAlert("Kein Screenshot gefunden", "Mach zuerst einen Screenshot.");
    return;
  }
  const resized = resizeImageIfNeeded(photos[0], 1568);
  const base64Png = Data.fromPNG(resized).toBase64String();

  // Aufraeumen: das Bild wurde nur zwischengespeichert, damit es sicher
  // uebergeben werden kann - in Fotos braucht es danach keiner mehr.
  try {
    await Photos.removeLatestPhotos(1);
  } catch (e) {
    // Loeschen fehlgeschlagen ist nicht kritisch, einfach ignorieren.
  }

  let existingTasks;
  try {
    existingTasks = await fetchOpenTasks();
  } catch (e) {
    await showAlert("Fehler beim Laden der Aufgaben", String(e));
    return;
  }

  let parsed;
  try {
    parsed = await analyzeScreenshot(base64Png, existingTasks);
  } catch (e) {
    await showAlert("Fehler bei der Analyse", String(e));
    return;
  }

  const validIds = new Set(existingTasks.map((t) => t.id));
  let action = ["create", "update", "duplicate"].includes(parsed.action) ? parsed.action : "create";
  let matchedTaskId = typeof parsed.matched_task_id === "string" ? parsed.matched_task_id : null;
  if ((action === "update" || action === "duplicate") && !validIds.has(matchedTaskId)) {
    action = "create";
    matchedTaskId = null;
  }

  if (action === "duplicate") {
    const matched = existingTasks.find((t) => t.id === matchedTaskId);
    await showAlert("Gibt's schon", `Nichts Neues zu: ${matched ? matched.title : "?"}`);
    return;
  }

  if (action === "update") {
    const matched = existingTasks.find((t) => t.id === matchedTaskId);
    const updateNote = String(parsed.update_note || "").trim();
    if (!updateNote) {
      await showAlert("Gibt's schon", `Nichts Neues zu: ${matched ? matched.title : "?"}`);
      return;
    }
    const existingSteps = Array.isArray(matched.steps) ? matched.steps : [];
    const newStep = { id: `s${Date.now()}`, text: updateNote, done: false };
    const req = supabaseRequest("PATCH", `tasks?id=eq.${encodeURIComponent(matchedTaskId)}`, {
      steps: [...existingSteps, newStep],
    });
    await req.loadJSON();
    await showAlert("Aktualisiert", `${matched.title}\n+ ${updateNote}`);
    return;
  }

  // action === "create"
  const title = String(parsed.title || "").slice(0, 200).trim();
  if (!title) {
    await showAlert("Nichts erkannt", "Auf dem Screenshot wurde keine Aufgabe gefunden.");
    return;
  }
  const description = String(parsed.description || "").slice(0, 1000).trim() || title;
  const category = ["process", "private"].includes(parsed.category) ? parsed.category : "today";
  const eventDatetime = String(parsed.event_datetime || "").trim();
  const eventTitle = String(parsed.event_title || "").slice(0, 200).trim();
  const recurrence = ["daily", "weekly", "monthly"].includes(parsed.recurrence) ? parsed.recurrence : "none";
  const recurrenceDayNum = Number(parsed.recurrence_day);
  const recurrenceDay =
    recurrence === "monthly" && Number.isInteger(recurrenceDayNum) && recurrenceDayNum >= 1 && recurrenceDayNum <= 31
      ? recurrenceDayNum
      : null;

  const payload = {
    title,
    description,
    category,
    recurrence,
    recurrence_day: recurrenceDay,
    status: "open",
    source: "screenshot",
    steps: [],
    event_datetime: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(eventDatetime) ? eventDatetime : null,
    event_title: eventTitle || null,
  };

  const req = supabaseRequest("POST", "tasks", payload);
  await req.loadJSON();

  await showAlert("Aufgabe gespeichert", title);
}

await main();
Script.complete();
