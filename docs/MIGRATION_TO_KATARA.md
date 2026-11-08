# Migrasi ke Katara Green

Layer data dipisah dari UI: `src/lib/antares` mengintegrasikan sumber telemetry, `src/lib/decoder` mendefinisikan hasil decode, `src/lib/db` menjadi repository, dan halaman menggunakan tipe di `src/types/telemetry.ts`. Untuk backend Katara Green, implementasikan adapter repository baru dengan output `DeviceWithLatest`, `Reading`, dan `Summary` yang sama, lalu tukar repository tanpa mengubah komponen.

## Ekspor

1. Dari Supabase Dashboard → **Table Editor** → `readings` → Export CSV (atau jalankan query terautentikasi server-side untuk JSON).
2. Ekspor `devices` terpisah; metadata perangkat bukan data hasil ukur.
3. Simpan dump secara aman, batasi akses karena raw payload adalah data telemetri, dan jangan memasukkan credential ke arsip.
4. Pertahankan `id` idempotensi, `dev_eui`, waktu ISO UTC, payload HEX, status decode, dan timestamp radio secara terpisah.

## Model yang harus dipertahankan

- `devices`: `serial`, `dev_eui`, `dn`, `q3_m3_per_hour`, `location`, `expected_interval_minutes`.
- `readings`: idempotency key, serial+DevEUI, `received_at`, `radio_gps_time`, `meter_time`, nilai ukur nullable, `status_raw`, `decode_status`, `decode_message`, raw HEX, serta metadata LoRaWAN.
- `decode_status=partial/error` wajib dipertahankan; jangan mengubah field `null` menjadi angka default.
- RLS/otorisasi minimum tetap berlaku pada penyimpanan baru. Jangan berikan akses raw telemetry publik tanpa keputusan privasi yang jelas.

Uji adapter baru dengan fixture meter 52 dan kasus payload rusak sebelum memindahkan trafik real. Decoder harus diganti/diperluas hanya setelah dokumen protokol vendor diverifikasi.
