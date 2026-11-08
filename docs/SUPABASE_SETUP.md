# Setup Supabase histori SIAB

Supabase dipakai hanya dari backend Next.js. Gunakan `SUPABASE_SECRET_KEY` server-only; aplikasi saat ini tidak menginisialisasi Supabase client di browser, sehingga `SUPABASE_PUBLISHABLE_KEY` tidak diperlukan untuk sinkronisasi atau pembacaan dashboard.

## Konfigurasi lokal

Isi `.env.local` di root proyek secara lokal, tanpa mengirim nilai ke chat atau commit file tersebut:

- `NEXT_PUBLIC_SUPABASE_URL`: URL project Supabase
- `SUPABASE_SECRET_KEY`: secret/service key server-side
- `SUPABASE_PUBLISHABLE_KEY`: opsional selama belum ada akses database dari browser
- `DEMO_MODE=false`: aktifkan repository real
- `INTERNAL_SYNC_TOKEN`: token acak panjang untuk endpoint sinkronisasi/backfill

Setelah mengubah `.env.local`, restart `next dev` agar konfigurasi dimuat ulang.

## SQL Editor

Di Supabase Dashboard → **SQL Editor**, buka lalu jalankan file migration dari root repository satu per satu, sesuai urutan:

1. `supabase/migrations/001_init.sql`
2. `supabase/migrations/002_antares_raw_response.sql`
3. `supabase/migrations/003_telemetry_history.sql`

Migration ketiga membuat `telemetry_readings` dan `sync_logs`, memasukkan metadata empat meter, dan menyalin histori lama dari `readings` secara idempotent. Ia tidak menghapus tabel lama. Primary key ANTARES `ri` menjadi ID unik pembacaan; `ON CONFLICT DO NOTHING` mengabaikan uplink yang sudah tersimpan.

Semua tabel mengaktifkan RLS, mencabut akses dari `PUBLIC`, `anon`, dan `authenticated`, lalu memberi akses hanya pada role `service_role`. Jangan menaruh secret/service key di variabel `NEXT_PUBLIC_*`.

## Verifikasi database

Setelah migration berhasil, periksa skema, metadata, histori, log, dan grants melalui SQL Editor:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('devices', 'telemetry_readings', 'sync_logs')
order by table_name;

select serial, dev_eui, dn, q3_m3_per_hour, location
from public.devices
where serial in ('26261648', '26261649', '26261652', '26261654')
order by serial;

select count(*) as reading_count,
       min(received_at) as first_received_at_utc,
       max(received_at) as last_received_at_utc
from public.telemetry_readings
where serial = '26261652';

select operation, status, sum(fetched_count) as fetched,
       sum(inserted_count) as inserted,
       sum(duplicate_count) as duplicates_ignored,
       sum(failed_count) as failed
from public.sync_logs
where meter_serial = '26261652'
group by operation, status
order by operation, status;

select has_table_privilege('anon', 'public.telemetry_readings', 'INSERT') as anon_can_insert,
       has_table_privilege('authenticated', 'public.telemetry_readings', 'INSERT') as authenticated_can_insert,
       has_table_privilege('service_role', 'public.telemetry_readings', 'INSERT') as service_role_can_insert;
```

Waktu `timestamptz` disimpan dalam UTC; UI mengubahnya ke `Asia/Jakarta`.

## Backfill meter 26261652

Restart aplikasi sesudah konfigurasi. Pastikan `GET /api/health` menunjukkan `database=connected`, `antares=reachable`, dan `mode=real`. Tombol **Sync Now** hanya membaca latest uplink. **Backfill History** memerlukan `INTERNAL_SYNC_TOKEN` dan mengakses endpoint ID-list ANTARES (`?fu=1&ty=4&drt=1`), kemudian membaca resource `m2m:cin` satu per satu. ID ANTARES dipakai untuk deduplikasi.

Untuk membatasi backfill ke meter 52, kirim `POST /api/sync?serial=26261652&backfill=true` dengan header `Authorization: Bearer <INTERNAL_SYNC_TOKEN>` dari pemanggil tepercaya. Endpoint tetap dibatasi rate dan token. Jangan menaruh token di URL atau source frontend.

Uplink hanya dapat dipakai untuk debit/konsumsi jika field decoding dinyatakan terverifikasi. Payload yang hanya lolos validasi frame tetap memiliki nilai decoded null dan tidak masuk hitungan. Pembacaan historis tidak dihapus saat meter menjadi stale atau offline.
