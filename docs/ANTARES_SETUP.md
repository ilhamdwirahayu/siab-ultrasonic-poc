# Setup ANTARES (server-side, read-only)

Sumber teknis: [REST data of device](https://docs.antares.id/api-or-http/data-of-device) dan [HTTP subscribe/notify](https://docs.antares.id/contoh-kode-dan-library/http-or-subscribe-and-notify-mechanism).

## Konfigurasi

Salin `.env.example` sebagai `.env.local`, lalu isi hanya:

- `ANTARES_API_BASE_URL=https://platform.antares.id:8443`
- `ANTARES_APPLICATION=SIAB-US-01`
- `ANTARES_ACCESS_KEY` dari akun ANTARES; simpan server-only
- `ANTARES_FRESHNESS_MINUTES=480` sebagai ambang status `FRESH`/`STALE` (default 8 jam, sementara menunggu interval vendor dikonfirmasi; ini bukan deteksi offline)
- `NEXT_PUBLIC_SUPABASE_URL` dan `SUPABASE_SECRET_KEY` untuk histori Supabase server-side
- `SUPABASE_PUBLISHABLE_KEY` hanya bila kelak ditambahkan akses database dari browser; dashboard sekarang tidak memakai key ini
- `INTERNAL_SYNC_TOKEN` dengan nilai acak panjang, hanya untuk pemanggil admin/scheduled job
- `CRON_SECRET` nilai acak panjang terpisah untuk autentikasi Vercel Cron
- Biarkan `DEMO_MODE=true` sampai uji real berhasil.

Tidak diperlukan dan jangan masukkan AppKey/JoinEUI LoRaWAN. Aplikasi tidak mengubah konfigurasi OTAA.

## Uji latest

Route latest yang digunakan sesuai bentuk REST ANTARES:

`GET https://platform.antares.id:8443/~/antares-cse/antares-id/SIAB-US-01/26261652/la`

Header yang dipakai server: `X-M2M-Origin`, `Content-Type: application/json`, dan `Accept: application/json`. Gunakan route health untuk menguji konfigurasi dan koneksi tanpa menampilkan credential:

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

## Sinkronisasi otomatis dan pengujian production

Gunakan scheduled polling, bukan webhook ANTARES: endpoint latest sudah teruji, sedangkan format notifikasi dan autentikasi webhook belum diverifikasi. `vercel.json` menjadwalkan `GET /api/sync` setiap lima menit. Frekuensi ini memerlukan Vercel Pro atau Enterprise; paket Hobby hanya mengizinkan satu jadwal per hari, sehingga deployment dengan konfigurasi lima menit akan ditolak oleh Vercel. Route hanya menerima `Authorization: Bearer <CRON_SECRET>`; request tanpa token ditolak. Sinkronisasi manual/backfill tetap memakai `POST /api/sync` dan `INTERNAL_SYNC_TOKEN`. Jangan jadwalkan backfill.

Saat sinkronisasi gagal, request jaringan/timeout/HTTP 429/5xx dicoba ulang secara terbatas. Log hanya menyimpan jenis/status kegagalan dan tidak menyimpan key atau token. Upsert tetap memakai Resource ID ANTARES agar pemanggilan berulang tidak menggandakan pembacaan. Timestamp disimpan UTC; dashboard menampilkannya dalam WIB dan menetapkan `STALE` dari freshness aktual atau `NO DATA` bila belum ada histori.

Sebelum menandai otomatisasi production aktif, deploy secara manual setelah persetujuan lalu:

1. Pastikan paket Vercel Pro/Enterprise aktif untuk jadwal lima menit, lalu pastikan Cron Jobs mencantumkan `/api/sync`.
2. Pastikan Environment Variables Production mencakup `DEMO_MODE=false`, URL/application ANTARES, `ANTARES_ACCESS_KEY`, Supabase URL dan `SUPABASE_SECRET_KEY`, `ANTARES_FRESHNESS_MINUTES=480`, `INTERNAL_SYNC_TOKEN`, dan `CRON_SECRET` acak minimal 16 karakter tanpa whitespace tepi. Jangan beri prefix `NEXT_PUBLIC_` pada secrets. Perbarui freshness lama 60 menit; `STALE` tidak membuktikan perangkat offline.
3. Di ANTARES, tidak perlu membuat webhook atau mengubah konfigurasi LoRaWAN. Pastikan `SIAB-US-01` berisi device yang benar dan access key yang disimpan di Vercel berhak membaca latest resource untuk application tersebut.
4. Uji `/api/health` (mode real, database connected, ANTARES reachable), lalu dashboard membaca histori dari Supabase.
5. Verifikasi request cron berhasil di Function Logs dan `sync_logs`; uji pula tanpa token (`401`), timestamp `STALE`/`NO DATA`, serta bahwa Browser Network/Sources tidak memuat ANTARES/Supabase secrets.
6. Matikan laptop dan pastikan cron tetap menambah uplink baru saat perangkat mengirim data. Jangan memicu sync production dalam tes ini sebelum pemilik menyetujui operasi yang menulis ke Supabase.

## History dan webhook

Perilaku backfill saat ini membaca semua ID yang dikembalikan dalam `m2m:uril`; batas 100 ID di instruksi lama sudah tidak berlaku. Respons live meter 26261652 berisi 12 ID tanpa continuation token. Dokumentasi endpoint tidak menyebut dukungan pagination.

Dokumentasi REST ANTARES mencontohkan list content instance `m2m:list`, list ID `m2m:uril`, dan resource `m2m:cin` dengan `ri`/`ct`. Implementasi membaca endpoint ID-list yang terdokumentasi dan membatasi batch; dokumentasi tersebut tidak mendefinisikan pagination dalam contoh yang digunakan. Jika lebih dari 100 ID ditemukan, respons menandai hasil terpotong. Sinkronisasi berulang idempotent pada `ri` ANTARES.

`POST /api/antares/webhook` sengaja menolak request dengan 501. Petunjuk subscribe/notify ANTARES menjelaskan request dan payload contoh, tetapi sebelum mengaktifkan write endpoint, verifikasi format `m2m:sgn` yang benar-benar dikirim dan validasi mekanisme autentikasi/notifikasi khusus deployment. Tes emulator dokumentasi bukan bukti webhook produksi aman.

Setelah terverifikasi, tambahkan tes fixture redacted untuk request notification, autentikasi kuat, deduplikasi, dan insert idempotent sebelum membuka endpoint tersebut.
