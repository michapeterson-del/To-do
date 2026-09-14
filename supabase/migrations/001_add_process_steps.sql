-- Fuer bereits bestehende Datenbanken (schema.sql schon mal ausgefuehrt):
-- im Supabase SQL Editor einmalig ausfuehren, um die neuen Spalten
-- fuer "Bisherige Schritte" / "Naechste Schritte" nachzuruesten.

alter table public.tasks add column if not exists last_steps text not null default '';
alter table public.tasks add column if not exists next_steps text not null default '';
