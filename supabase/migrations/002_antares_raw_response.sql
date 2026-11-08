alter table public.readings
  add column if not exists antares_response jsonb;
