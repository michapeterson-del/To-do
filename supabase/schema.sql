-- Im Supabase SQL Editor (Projekt -> SQL Editor -> New query) ausfuehren.

create extension if not exists pgcrypto;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  category text not null default 'today' check (category in ('today', 'process', 'private')),
  status text not null default 'open' check (status in ('open', 'done')),
  source text not null default 'manual' check (source in ('manual', 'screenshot')),
  -- Checkliste fuer Prozess-Aufgaben: [{"id": "...", "text": "...", "done": false}, ...]
  steps jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_category_idx on public.tasks (category);
create index if not exists tasks_created_at_idx on public.tasks (created_at);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- Persoenliches Einzelnutzer-Tool: RLS ist aktiviert, die Policy erlaubt dem
-- anon-Key aber vollen Zugriff (kein Login-Flow noetig). Wenn du die
-- Supabase-URL/den Key jemals teilst, hat jeder mit diesen Daten vollen
-- Zugriff auf die Tabelle - dann Policies verschaerfen oder Auth ergaenzen.
alter table public.tasks enable row level security;

drop policy if exists "Allow anon full access" on public.tasks;
create policy "Allow anon full access" on public.tasks
  for all
  using (true)
  with check (true);
