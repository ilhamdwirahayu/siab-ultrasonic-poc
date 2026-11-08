create table if not exists public.telemetry_readings (
  id text primary key,
  serial text not null references public.devices(serial),
  dev_eui text not null,
  received_at timestamptz not null,
  radio_gps_time timestamptz null,
  meter_time timestamptz null,
  forward_m3 numeric null,
  reverse_m3 numeric null,
  flow_m3_per_hour numeric null,
  temperature_c numeric null,
  status_raw text null,
  decode_status text not null check (decode_status in ('decoded', 'partial', 'error')),
  decode_message text not null default '',
  payload_hex text not null,
  port integer null check (port between 0 and 255),
  frequency_mhz numeric null,
  spreading_factor integer null,
  rssi numeric null,
  snr numeric null,
  counter bigint null,
  antares_response jsonb null,
  created_at timestamptz not null default now(),
  check (dev_eui ~ '^[0-9a-f]{16}$'),
  check (payload_hex ~ '^([0-9a-f]{2})+$')
);

create index if not exists telemetry_readings_serial_received_at_idx
  on public.telemetry_readings (serial, received_at desc);
create index if not exists telemetry_readings_dev_eui_received_at_idx
  on public.telemetry_readings (dev_eui, received_at desc);

create table if not exists public.sync_logs (
  id bigint generated always as identity primary key,
  operation text not null check (operation in ('latest', 'backfill')),
  meter_serial text not null references public.devices(serial),
  status text not null check (status in ('success', 'partial', 'failed')),
  fetched_count integer not null default 0 check (fetched_count >= 0),
  inserted_count integer not null default 0 check (inserted_count >= 0),
  duplicate_count integer not null default 0 check (duplicate_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  started_at timestamptz not null,
  completed_at timestamptz not null default now(),
  error_message text null
);

create index if not exists sync_logs_meter_completed_idx
  on public.sync_logs (meter_serial, completed_at desc);

insert into public.devices (serial, dev_eui, dn, q3_m3_per_hour, location)
values
  ('26261648', '8cf95720001cd359', 'DN15', 2.5, 'Lokasi pelanggan belum ditetapkan'),
  ('26261649', '8cf95720001cd496', 'DN15', 2.5, 'Lokasi pelanggan belum ditetapkan'),
  ('26261652', '8cf95720001cd395', 'DN15', 2.5, 'STO Babarsari (uplink terbukti; pengujian kering)'),
  ('26261654', '8cf95720001cdc7c', 'DN15', 2.5, 'Lokasi pelanggan belum ditetapkan')
on conflict (serial) do update set
  dev_eui = excluded.dev_eui,
  dn = excluded.dn,
  q3_m3_per_hour = excluded.q3_m3_per_hour;

do $$
begin
  if to_regclass('public.readings') is not null then
    insert into public.telemetry_readings (
      id, serial, dev_eui, received_at, radio_gps_time, meter_time,
      forward_m3, reverse_m3, flow_m3_per_hour, temperature_c, status_raw,
      decode_status, decode_message, payload_hex, port, frequency_mhz,
      spreading_factor, rssi, snr, counter, antares_response, created_at
    )
    select
      id, serial, dev_eui, received_at, radio_gps_time, meter_time,
      forward_m3, reverse_m3, flow_m3_per_hour, temperature_c, status_raw,
      decode_status, decode_message, payload_hex, port, frequency_mhz,
      spreading_factor, rssi, snr, counter, antares_response, created_at
    from public.readings
    on conflict (id) do nothing;
  end if;
end
$$;

alter table public.devices enable row level security;
alter table public.telemetry_readings enable row level security;
alter table public.sync_logs enable row level security;

revoke all on public.devices from public, anon, authenticated;
revoke all on public.telemetry_readings from public, anon, authenticated;
revoke all on public.sync_logs from public, anon, authenticated;
grant select, insert, update, delete on public.devices to service_role;
grant select, insert, update, delete on public.telemetry_readings to service_role;
grant select, insert, update, delete on public.sync_logs to service_role;
grant usage, select on sequence public.sync_logs_id_seq to service_role;
