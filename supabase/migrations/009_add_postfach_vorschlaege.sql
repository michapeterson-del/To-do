-- Im SQL Editor / psql einmalig ausfuehren: Tabelle fuer die Vorschlaege des
-- Postfach-Agenten (liest Lieferanten-Mails und schlaegt Aktionen vor).
--
-- Der Agent legt pro relevanter Mail EINE Zeile an (nur INSERT). Ueber
-- message_id (unique) werden doppelte Vorschlaege fuer dieselbe Mail
-- verhindert. Die App setzt nur den status (open -> done / dismissed).
--
--   kind:    promotion      Aktion/Promotion des Lieferanten -> an den Vertrieb
--            price_change   Preis aendert sich
--            delivery_date  neuer/geaenderter Liefertermin (AB, Versandmeldung, Verschiebung)
--            other          sonstiges Relevantes
--   details  {"old_price": 120.5, "new_price": 115, "old_date": "2026-11-20",
--             "new_date": "2026-12-04", "valid_from": "2026-11-15", "valid_until": "2026-12-31"}

create table if not exists public.postfach_vorschlaege (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  message_id text not null unique,
  received_at timestamptz,
  sender text not null default '',
  subject text not null default '',
  kind text not null default 'other' check (kind in ('promotion', 'price_change', 'delivery_date', 'other')),
  supplier text not null default '',
  order_no text,
  article text,
  summary text not null default '',
  suggestion text not null default '',
  details jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'done', 'dismissed'))
);

create index if not exists postfach_vorschlaege_created_at_idx on public.postfach_vorschlaege (created_at desc);

drop trigger if exists postfach_vorschlaege_set_updated_at on public.postfach_vorschlaege;
create trigger postfach_vorschlaege_set_updated_at
  before update on public.postfach_vorschlaege
  for each row execute function public.set_updated_at();

alter table public.postfach_vorschlaege enable row level security;

drop policy if exists "Allow anon full access" on public.postfach_vorschlaege;
create policy "Allow anon full access" on public.postfach_vorschlaege
  for all
  using (true)
  with check (true);

grant select, insert, update, delete on public.postfach_vorschlaege to anon;

notify pgrst, 'reload schema';
