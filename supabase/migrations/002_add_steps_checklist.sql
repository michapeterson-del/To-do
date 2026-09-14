-- Im Supabase SQL Editor einmalig ausfuehren: ersetzt die Freitextfelder
-- "Bisherige/Naechste Schritte" durch eine echte Checkliste pro Aufgabe.
-- (001_add_process_steps.sql muss dafuer NICHT vorher ausgefuehrt worden sein.)

alter table public.tasks add column if not exists steps jsonb not null default '[]'::jsonb;
