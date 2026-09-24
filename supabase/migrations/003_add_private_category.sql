-- Im Supabase SQL Editor einmalig ausfuehren: erlaubt die neue Kategorie
-- "private" zusaetzlich zu "today" und "process".

alter table public.tasks drop constraint if exists tasks_category_check;
alter table public.tasks add constraint tasks_category_check
  check (category in ('today', 'process', 'private'));
