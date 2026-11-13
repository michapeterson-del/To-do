-- Im SQL Editor einmalig ausfuehren: Tabelle fuer das Einkaufs-Dashboard.
--
-- Der KI-Agent "Einkaufs-Analyst" schreibt nach jedem Lauf GENAU EINE neue
-- Zeile hier hinein (nur INSERT). Die App zeigt immer die neueste Zeile als
-- Dashboard an (Tab "📦 Einkauf"). Aufgaben in public.tasks fasst der Agent
-- nicht an - daraus wird erst eine Aufgabe, wenn du im Dashboard auf
-- "+ Aufgabe" klickst.
--
-- Aufbau der Spalten (JSON):
--   summary    {"open_orders": 268, "overdue_positions": 191, "overdue_orders": 82,
--               "overdue_value_eur": 4080000, "unconfirmed_orders": 12, "suppliers": 68}
--   highlights ["Sigenergy SigenMate BS2026101951 seit 80 Tagen ueberfaellig", ...]
--   items      [{"order": "BS2026101951", "supplier": "Sigenergy", "article": "SigenMate",
--                "problem": "overdue", "severity": 3, "days_overdue": 80,
--                "open_value_eur": 12345.67, "due_date": "2026-08-25",
--                "note": "nichts geliefert, kein neuer Termin", "change": "new"}, ...]
--     problem:  overdue | unconfirmed | date_mismatch | partial | price
--     severity: 1 = niedrig, 2 = mittel, 3 = dringend
--     change:   new | worse | same | better   (Vergleich mit dem letzten Lauf)

create table if not exists public.einkauf_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- Zeitpunkt der xentral-Daten (Permalink-Export), falls bekannt.
  data_as_of timestamptz,
  summary jsonb not null default '{}'::jsonb,
  highlights jsonb not null default '[]'::jsonb,
  items jsonb not null default '[]'::jsonb
);

create index if not exists einkauf_reports_created_at_idx on public.einkauf_reports (created_at desc);

-- Gleiches Modell wie bei public.tasks: Einzelnutzer-Tool, der API-Key hat
-- vollen Zugriff. Der Agent wird per Prompt auf INSERT beschraenkt.
alter table public.einkauf_reports enable row level security;

drop policy if exists "Allow anon full access" on public.einkauf_reports;
create policy "Allow anon full access" on public.einkauf_reports
  for all
  using (true)
  with check (true);
