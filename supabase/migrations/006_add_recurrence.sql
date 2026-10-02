-- Im Supabase SQL Editor einmalig ausfuehren: erlaubt wiederkehrende
-- Aufgaben. 'none' = einmalig (Standard), sonst 'daily'/'weekly'/'monthly'.
-- Die eigentliche Wiedereroeffnung passiert client-seitig beim Laden der
-- Aufgaben (kein Cron/Server-Job noetig) - siehe mobile/index.html und
-- src/renderer/planner/planner.js.

alter table public.tasks add column if not exists recurrence text not null default 'none'
  check (recurrence in ('none', 'daily', 'weekly', 'monthly'));
