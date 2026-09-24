// Aufgabenplaner Home-Bildschirm-Widget (Scriptable)
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

const SUPABASE_URL = "https://DEINE-PROJEKT-ID.supabase.co";
const SUPABASE_ANON_KEY = "DEIN-ANON-KEY";
const APP_URL = "https://michapeterson-del.github.io/To-do/mobile/";

async function fetchTasks() {
  const url = `${SUPABASE_URL}/rest/v1/tasks?select=title,category,status,created_at&status=eq.open&order=created_at.asc`;
  const req = new Request(url);
  req.headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };
  return await req.loadJSON();
}

function createWidget(tasks, errorMessage) {
  const w = new ListWidget();
  w.backgroundColor = new Color("#1c1d2b");
  w.url = APP_URL;

  const header = w.addText("📋 Aufgaben");
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
    const icon = task.category === "process" ? "🔁" : "☀️";
    const line = w.addText(`${icon} ${task.title}`);
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
