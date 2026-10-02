-- Im Supabase SQL Editor einmalig ausfuehren: erlaubt, bei monatlicher
-- Wiederholung einen festen Tag des Monats (1-31) festzulegen, an dem die
-- Aufgabe wieder auftauchen soll. Ohne gesetzten Wert faellt die monatliche
-- Wiederholung weiterhin auf das einfache 29-Tage-Intervall zurueck.

alter table public.tasks add column if not exists recurrence_day smallint
  check (recurrence_day is null or (recurrence_day between 1 and 31));
