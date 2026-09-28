// Aufgabenplaner Home-Bildschirm-Widget (Scriptable)
//
// Ein Script fuer alle 3 Kategorien - welche Kategorie ein Widget zeigt,
// wird ueber den Widget-Parameter eingestellt (nicht im Script selbst).
//
// Einrichtung:
// 1. "Scriptable" App aus dem App Store laden (kostenlos).
// 2. Neues Script anlegen, diesen ganzen Text reinkopieren.
// 3. Unten bei SUPABASE_URL und SUPABASE_ANON_KEY deine eigenen Werte
//    eintragen (dieselben wie in den Einstellungen der Desktop-App /
//    mobilen Seite).
// 4. Script einmal per Play-Button testen.
// 5. Auf dem Home-Bildschirm: gedrueckt halten -> "+" -> "Scriptable"
//    suchen -> Widget-Groesse waehlen -> hinzufuegen -> bei "Script"
//    dieses Script auswaehlen.
// 6. Auf das neu hinzugefuegte Widget tippen und halten -> "Widget
//    bearbeiten" -> Feld "Parameter" ausfuellen mit: today, process
//    oder private
// 7. Schritt 5+6 zweimal wiederholen fuer die anderen beiden
//    Kategorien - macht 3 Widgets mit demselben Script.

const SUPABASE_URL = "https://DEINE-PROJEKT-ID.supabase.co";
const SUPABASE_ANON_KEY = "DEIN-ANON-KEY";
const APP_URL = "https://michapeterson-del.github.io/To-do/mobile/";

const CATEGORY_INFO = {
  today: { label: "☀️ Heute", icon: "☀️" },
  process: { label: "🔁 Prozesse", icon: "🔁" },
  private: { label: "🔒 Privat", icon: "🔒" },
};

const category = CATEGORY_INFO[args.widgetParameter] ? args.widgetParameter : "today";
const info = CATEGORY_INFO[category];

async function fetchTasks() {
  const url = `${SUPABASE_URL}/rest/v1/tasks?select=title,status,created_at&status=eq.open&category=eq.${category}&order=created_at.asc`;
  const req = new Request(url);
  req.headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };
  return await req.loadJSON();
}

const LOCK_SCREEN_FAMILIES = ["accessoryRectangular", "accessoryCircular", "accessoryInline"];

function createLockScreenWidget(tasks, errorMessage) {
  const w = new ListWidget();

  if (config.widgetFamily === "accessoryInline") {
    // Nur eine einzige Textzeile moeglich.
    w.addText(errorMessage ? "Fehler" : !tasks.length ? "Keine Aufgaben" : `${info.icon} ${tasks[0].title}`);
    return w;
  }

  if (config.widgetFamily === "accessoryCircular") {
    const t = w.addText(errorMessage ? "!" : String(tasks.length));
    t.font = Font.boldSystemFont(22);
    t.centerAlignText();
    return w;
  }

  // accessoryRectangular: sehr wenig Platz, max. 2 kurze Zeilen.
  const header = w.addText(info.label);
  header.font = Font.mediumSystemFont(12);

  if (errorMessage) {
    const t = w.addText("Fehler beim Laden");
    t.font = Font.systemFont(11);
    return w;
  }

  if (!tasks.length) {
    const t = w.addText("Keine offenen Aufgaben 🎉");
    t.font = Font.systemFont(11);
    return w;
  }

  const first = w.addText(tasks[0].title);
  first.font = Font.systemFont(11);
  first.lineLimit = 1;

  if (tasks.length > 1) {
    const more = w.addText(`+${tasks.length - 1} weitere`);
    more.font = Font.systemFont(10);
  }

  return w;
}

function createHomeScreenWidget(tasks, errorMessage) {
  const w = new ListWidget();
  w.backgroundColor = new Color("#1c1d2b");

  const header = w.addText(info.label);
  header.font = Font.boldSystemFont(14);
  header.textColor = Color.white();
  w.addSpacer(6);

  if (errorMessage) {
    const t = w.addText("Fehler beim Laden");
    t.font = Font.systemFont(12);
    t.textColor = Color.red();
    return w;
  }

  if (!tasks.length) {
    const t = w.addText("Keine offenen Aufgaben 🎉");
    t.font = Font.systemFont(12);
    t.textColor = Color.gray();
    return w;
  }

  const family = config.widgetFamily || "medium";
  const maxItems = family === "large" ? 8 : family === "medium" ? 4 : 3;

  for (const task of tasks.slice(0, maxItems)) {
    const line = w.addText(`${info.icon} ${task.title}`);
    line.font = Font.systemFont(12);
    line.textColor = Color.white();
    line.lineLimit = 1;
    w.addSpacer(4);
  }

  if (tasks.length > maxItems) {
    const more = w.addText(`+${tasks.length - maxItems} weitere`);
    more.font = Font.systemFont(10);
    more.textColor = Color.gray();
  }

  return w;
}

function createWidget(tasks, errorMessage) {
  const w = LOCK_SCREEN_FAMILIES.includes(config.widgetFamily)
    ? createLockScreenWidget(tasks, errorMessage)
    : createHomeScreenWidget(tasks, errorMessage);
  w.url = APP_URL;
  return w;
}

let tasks = [];
let errorMessage = null;
try {
  tasks = await fetchTasks();
} catch (e) {
  errorMessage = String(e);
}

const widget = createWidget(tasks, errorMessage);

if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  await widget.presentMedium();
}
Script.complete();
