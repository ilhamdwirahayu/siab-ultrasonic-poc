create table if not exists public.devices (
  serial text primary key check (serial ~ '^[0-9]{8}$'),
  dev_eui text not null unique check (dev_eui ~ '^[0-9a-f]{16}$'),
  dn text not null default 'DN15',
  q3_m3_per_hour numeric not null default 2.5,
  location text not null,
  expected_interval_minutes integer null check (expected_interval_minutes > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.readings (
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
  created_at timestamptz not null default now(),
  check (dev_eui ~ '^[0-9a-f]{16}$'),
  check (payload_hex ~ '^([0-9a-f]{2})+$')
);

create index if not exists readings_serial_received_at_idx
  on public.readings (serial, received_at desc);
create index if not exists readings_dev_eui_received_at_idx
  on public.readings (dev_eui, received_at desc);

insert into public.devices (serial, dev_eui, dn, q3_m3_per_hour, location)
values
  ('26261648', '8cf95720001cd359', 'DN15', 2.5, 'Lokasi pelanggan belum ditetapkan'),
  ('26261649', '8cf95720001cd496', 'DN15', 2.5, 'Lokasi pelanggan belum ditetapkan'),
  ('26261652', '8cf95720001cd395', 'DN15', 2.5, 'STO Babarsari (uplink terbukti; pengujian kering)'),
  ('26261654', '8cf95720001cdc7c', 'DN15', 2.5, 'Lokasi pelanggan belum ditetapkan')
on conflict (serial) do nothing;

alter table public.devices enable row level security;
alter table public.readings enable row level security;

revoke all on public.devices from anon, authenticated;
revoke all on public.readings from anon, authenticated;
grant select, insert, update, delete on public.devices to service_role;
grant select, insert, update, delete on public.readings to service_role;
