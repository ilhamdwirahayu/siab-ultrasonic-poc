# Setup ANTARES (server-side, read-only)

Sumber teknis: [REST data of device](https://docs.antares.id/api-or-http/data-of-device) dan [HTTP subscribe/notify](https://docs.antares.id/contoh-kode-dan-library/http-or-subscribe-and-notify-mechanism).

## Konfigurasi

Salin `.env.example` sebagai `.env.local`, lalu isi hanya:

- `ANTARES_API_BASE_URL=https://platform.antares.id:8443`
- `ANTARES_APPLICATION=SIAB-US-01`
- `ANTARES_ACCESS_KEY` dari akun ANTARES; simpan server-only
- `ANTARES_FRESHNESS_MINUTES=60` sebagai ambang status `FRESH`/`STALE` (default 60 menit)
- `NEXT_PUBLIC_SUPABASE_URL` dan `SUPABASE_SECRET_KEY` untuk histori Supabase server-side
- `SUPABASE_PUBLISHABLE_KEY` hanya bila kelak ditambahkan akses database dari browser; dashboard sekarang tidak memakai key ini
- `INTERNAL_SYNC_TOKEN` dengan nilai acak panjang, hanya untuk pemanggil admin/scheduled job
- Biarkan `DEMO_MODE=true` sampai uji real berhasil.

Tidak diperlukan dan jangan masukkan AppKey/JoinEUI LoRaWAN. Aplikasi tidak mengubah konfigurasi OTAA.

## Uji latest

Route latest yang digunakan sesuai bentuk REST ANTARES:

`GET https://platform.antares.id:8443/~/antares-cse/antares-id/SIAB-US-01/26261652/la`

Header yang dipakai server: `X-M2M-Origin` dan `Accept: application/json`. Gunakan route health untuk menguji konfigurasi dan koneksi tanpa menampilkan credential:

```powershell
Invoke-RestMethod http://localhost:3000/api/health
```

Sinkronisasi (`POST /api/sync`) menerima `Authorization: Bearer <INTERNAL_SYNC_TOKEN>`, melakukan GET latest per device dengan timeout, memverifikasi DevEUI terhadap serial yang telah dikonfigurasi, lalu upsert ke Supabase. Tambahkan `?backfill=true` untuk mengambil daftar ID yang didokumentasikan (`fu=1&ty=4&drt=1`), lalu membaca content-instance satu per satu. Backfill dibatasi 100 ID per meter dengan batch lima; respons menunjukkan jumlah gagal dan apakah hasil dipotong. Uji batas durasi function dan ukuran data di akun nyata sebelum memakai backfill pada Vercel. Rate limit proses saat ini membatasi satu sync per menit per instance. Gunakan hanya dari admin/scheduled job; jangan mengirim token lewat URL atau menyematkannya dalam frontend.

Endpoint POST sync lokal dapat diuji dengan PowerShell tanpa mencetak key:

```powershell
$token = Read-Host "Internal sync token"
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/sync -Headers @{ Authorization = "Bearer $token" }
```

Untuk backfill gunakan URL `http://localhost:3000/api/sync?backfill=true` dengan header Authorization yang sama.

Respons `m2m:cin` asli disimpan tanpa transformasi di kolom `telemetry_readings.antares_response` untuk debugging. Jalankan migrasi berurutan sampai `003_telemetry_history.sql` sebelum menjalankan sinkronisasi real. Data simulasi tetap ditandai sebagai demo dan tidak dianggap sebagai uplink ANTARES. Status `FRESH` hanya berarti timestamp uplink berada dalam ambang freshness; status ini tidak menyatakan perangkat online. Panduan database dan backfill ada di [SUPABASE_SETUP.md](./SUPABASE_SETUP.md).

## History dan webhook

Perilaku backfill saat ini membaca semua ID yang dikembalikan dalam `m2m:uril`; batas 100 ID di instruksi lama sudah tidak berlaku. Respons live meter 26261652 berisi 12 ID tanpa continuation token. Dokumentasi endpoint tidak menyebut dukungan pagination.

Dokumentasi REST ANTARES mencontohkan list content instance `m2m:list`, list ID `m2m:uril`, dan resource `m2m:cin` dengan `ri`/`ct`. Implementasi membaca endpoint ID-list yang terdokumentasi dan membatasi batch; dokumentasi tersebut tidak mendefinisikan pagination dalam contoh yang digunakan. Jika lebih dari 100 ID ditemukan, respons menandai hasil terpotong. Sinkronisasi berulang idempotent pada `ri` ANTARES.

`POST /api/antares/webhook` sengaja menolak request dengan 501. Petunjuk subscribe/notify ANTARES menjelaskan request dan payload contoh, tetapi sebelum mengaktifkan write endpoint, verifikasi format `m2m:sgn` yang benar-benar dikirim dan validasi mekanisme autentikasi/notifikasi khusus deployment. Tes emulator dokumentasi bukan bukti webhook produksi aman.

Setelah terverifikasi, tambahkan tes fixture redacted untuk request notification, autentikasi kuat, deduplikasi, dan insert idempotent sebelum membuka endpoint tersebut.
