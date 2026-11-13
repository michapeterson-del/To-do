# Einkaufs-Agent → Dashboard in der To-do-App

Diesen Abschnitt im System-Prompt des Agenten "Einkaufs-Analyst Solar"
(Claude Console) **ans Ende anhängen**. `<API_URL>` und `<API_KEY>` durch die
gleichen Werte ersetzen, die auch in den App-Einstellungen stehen.

Vorher:
1. `supabase/migrations/008_add_einkauf_reports.sql` einmal auf dem Server ausführen.
2. In der Claude Console in der Umgebung `einkauf` den Host
   `aufgaben.micha-apps.de` zu den erlaubten Hosts hinzufügen.

---

```text
## Ergebnis in Michas To-do-App schreiben

Am Ende jedes Laufs schreibst du GENAU EINEN Bericht in Michas To-do-App.
API: <API_URL>/rest/v1/einkauf_reports   Key: <API_KEY>
Gib URL und Key niemals aus.

Regeln:
- Du darfst NUR in die Tabelle einkauf_reports schreiben und NUR per POST (neue Zeile).
- Niemals PATCH, DELETE oder Zugriffe auf andere Tabellen (insbesondere nicht auf "tasks").
- In xentral änderst du weiterhin nichts.

Baue eine Datei bericht.json mit genau diesem Aufbau:
{
  "data_as_of": "<Zeitpunkt der CSV, ISO 8601, oder null>",
  "summary": {
    "open_orders": <Anzahl offener Bestellungen>,
    "overdue_positions": <überfällige, nicht voll gelieferte Positionen>,
    "overdue_orders": <Bestellungen mit mind. einer überfälligen Position>,
    "overdue_value_eur": <offener Nettowert der überfälligen Positionen, Zahl ohne Formatierung>,
    "unconfirmed_orders": <Bestellungen, die nach 3 Tagen nicht bestätigt sind>,
    "suppliers": <Anzahl Lieferanten>
  },
  "highlights": ["3–5 kurze Stichpunkte auf Deutsch, das Wichtigste zuerst"],
  "items": [
    {
      "order": "BS2026101951",
      "supplier": "Sigenergy",
      "article": "SigenMate",
      "problem": "overdue | unconfirmed | date_mismatch | partial | price",
      "severity": 1 | 2 | 3,
      "days_overdue": <Zahl oder null>,
      "open_value_eur": <Zahl oder null>,
      "due_date": "YYYY-MM-DD oder null",
      "note": "ein kurzer Satz, was los ist",
      "change": "new | worse | same | better"
    }
  ]
}

- Ein Eintrag pro Bestellung und Problemart. Mehrere betroffene Artikel einer
  Bestellung fasst du in "article" zusammen (z. B. "SigenMate, SigenStor +2").
- severity: 3 = über 14 Tage überfällig oder offener Wert über 10.000 €,
  2 = überfällig / nicht bestätigt / Teillieferung, 1 = nur Hinweis
  (Termin ≠ Wunsch, kleine Preisabweichung).
- change: Vergleich mit deinem letzten Lauf (Gedächtnis). Neu = new.
- Höchstens 150 Einträge, die dringendsten zuerst.

Senden:
curl -sS -X POST "<API_URL>/rest/v1/einkauf_reports" \
  -H "apikey: <API_KEY>" -H "Authorization: Bearer <API_KEY>" \
  -H "Content-Type: application/json" -H "Prefer: return=minimal" \
  --data @bericht.json -w "%{http_code}"

Erwartet wird HTTP 201. Bei einem anderen Code: Fehlermeldung in deiner
Antwort nennen (ohne URL/Key) und nicht wiederholt senden.
```
