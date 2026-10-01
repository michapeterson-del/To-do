-- Im Supabase SQL Editor einmalig ausfuehren: fuegt eine Prioritaet pro
-- Aufgabe hinzu (1 = niedrig, 2 = normal, 3 = hoch), damit Aufgaben nach
-- Wichtigkeit statt nur nach Erstelldatum sortiert werden koennen.

alter table public.tasks add column if not exists priority smallint not null default 2
  check (priority in (1, 2, 3));
