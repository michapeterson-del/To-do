-- Im Supabase SQL Editor einmalig ausfuehren: speichert einen aus einem
-- Screenshot erkannten Termin dauerhaft an der Aufgabe, statt ihn nur
-- kurz im Erfassen-Popup zu zeigen.

alter table public.tasks add column if not exists event_datetime timestamptz;
alter table public.tasks add column if not exists event_title text;
