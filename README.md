# Aufgabenplaner

Persoenlicher Desktop-Aufgabenplaner (Electron) mit zwei Spalten:

- **Heute** – konkrete Aufgaben fuer den Tag
- **Prozesse & Optimierungen** – uebergeordnete Themen, z.B. "Prozess X optimieren"

Kernfeature: Ein globales Tastenkuerzel macht von ueberall auf dem PC einen
Screenshot, schickt ihn an die Claude API (Vision) und schlaegt daraus eine
Aufgabe inkl. Kategorie vor, die du kurz bestaetigen/bearbeiten und speichern
kannst.

Aufgaben werden ueber eine eigene REST-API (PostgREST vor Postgres, gehostet
auf eigenem Server via Coolify) gespeichert, damit sie zentral verfuegbar sind.

## Einrichtung

### 1. Abhaengigkeiten installieren

```bash
npm install
```

### 2. API-Zugangsdaten eintragen

Die API laeuft unter `https://aufgaben.micha-apps.de` (Endpunkt `/rest/v1/`,
Header `apikey`). URL und API-Key traegst du in den App-Einstellungen ein
(gleiche Werte wie in der Mobile-Ansicht und den iOS-Scripts).

> Hinweis: Der API-Key hat vollen Lese-/Schreibzugriff auf die Tabelle, da
> dies ein reines Einzelnutzer-Tool ist. Teile URL/Key nicht mit anderen.

### 3. Anthropic API-Key erstellen

Key erstellen unter [console.anthropic.com](https://console.anthropic.com).

### 4. App starten

```bash
npm start
```

Beim ersten Start oeffnet sich automatisch das Einstellungsfenster. Dort:

- API-URL + API-Key eintragen
- Anthropic API-Key eintragen
- Claude-Modell pruefen (Standard: `claude-sonnet-5`)
- Gewuenschtes Tastenkuerzel eintragen (Standard: `CommandOrControl+Shift+T`,
  Electron-Accelerator-Syntax)
- Speichern

Danach steht das Tastenkuerzel systemweit zur Verfuegung – auch wenn die App
im Hintergrund/Tray laeuft.

### macOS: Bildschirmaufnahme-Berechtigung

Fuer Screenshots braucht die App unter **Systemeinstellungen → Datenschutz &
Sicherheit → Bildschirmaufnahme** einmalig Zugriff.

## Nutzung

- **Tastenkuerzel druecken** → Popup erscheint oben rechts, Screenshot wird
  analysiert → Titel/Notiz/Kategorie pruefen → Speichern (Strg/Cmd+Enter) oder
  Verwerfen (Esc).
- **Planer-Fenster**: Aufgaben manuell hinzufuegen, per Klick auf den Titel
  bearbeiten, per Checkbox erledigen, per ✕ loeschen.
- **Tray-Icon**: Planer oeffnen, Aufgabe jetzt erfassen, Einstellungen, Beenden.

## Architektur

```
src/main/        Electron-Main-Process (Fenster, IPC, Tastenkuerzel, Screenshot,
                  Claude-Anfrage, REST-Client fuer die API, lokale Einstellungen)
src/preload/      contextBridge-API fuer die Renderer-Fenster
src/renderer/      Drei einfache HTML/CSS/JS-Fenster: planner, capture, settings
supabase/schema.sql  Datenbankschema (PostgREST-kompatibel)
scripts/generate-icons.js  Erzeugt build/icon.png und build/tray.png
```

Es werden bewusst keine zusaetzlichen Laufzeit-Abhaengigkeiten genutzt – beide
Dienste werden ueber das in Electron eingebaute `fetch()` direkt per REST/HTTP
angesprochen, um die App schlank zu halten.

## Bekannte Grenzen

- Kein Echtzeit-Sync zwischen mehreren gleichzeitig offenen Fenstern/Geraeten –
  die Liste aktualisiert sich beim Oeffnen, bei Fokus und nach eigenen
  Aenderungen.
- Der API-Key hat vollen Lese-/Schreibzugriff auf die Tabelle (siehe Hinweis
  oben) – fuer den persoenlichen Gebrauch gedacht.
- Der Screenshot wird nur zur Analyse an die Claude API gesendet und nirgends
  gespeichert; in der Datenbank landet ausschliesslich der daraus erkannte
  Aufgabentext.

## Naechste moegliche Schritte

- Installer/Auto-Update via `electron-builder` fuer eine gepackte App.
- App-Autostart beim Systemstart einrichten (`app.setLoginItemSettings`).
- Echtzeit-Sync, falls mehrere Geraete gleichzeitig
  genutzt werden.
