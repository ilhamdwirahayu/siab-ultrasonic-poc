# SIAB Ultrasonic Monitoring — PoC Ancol 2026

Dashboard Next.js untuk empat Zhongpei 213E. Antarmuka berbahasa Indonesia, zona waktu `Asia/Jakarta`, dan dirancang sebagai aplikasi read-only.

> **Mode awal: DEMO.** Satu frame contoh historis meter `26261652` dipakai sebagai fixture, bukan pembacaan live. Tidak ada data pembacaan rekaan untuk tiga meter lainnya. Uplink tersebut terjadi saat pengujian kering di STO Babarsari; status mentah tidak digunakan untuk menyatakan meter rusak.

> Screenshot desktop: placeholder — ambil screenshot setelah aplikasi dijalankan dengan fixture demo.
>
> Screenshot mobile: placeholder — ambil screenshot pada lebar viewport 360 px setelah aplikasi dijalankan.

## Fitur

- Ringkasan 4 device, detail per meter, grafik, report printable, dan ekspor CSV.
- Digital twin berbasis geometri Three.js tanpa model eksternal; bisa diputar, dijeda, dan hanya menampilkan ilustrasi.
- Decoder menvalidasi frame 43 byte, header, panjang, terminator dan checksum aditif. Tanpa dokumen protokol vendor, hanya nilai yang telah diberikan untuk fixture persis yang ditampilkan; frame lain berstatus parsial dan field tidak diketahui bernilai `null`.
- API server-only untuk ANTARES dan Supabase. Tidak ada API key ANTARES atau service-role key pada browser.
- Supabase RLS aktif tanpa kebijakan publik untuk data mentah.
- Konsumsi harian memerlukan dua titik totalizer pada tanggal WIB yang sama; rollover/reset menghasilkan anomali, bukan pemakaian negatif.

## Mulai lokal (Windows PowerShell)

1. Pasang Node.js LTS (Node 20.9 atau lebih baru), Git, dan VS Code.
2. Dari folder proyek:

   ```powershell
   npm install
   Copy-Item .env.example .env.local
   npm run test
   npm run lint
   npm run build
   npm run dev
   ```

3. Buka `http://localhost:3000`. `.env.local` dapat dibiarkan dengan nilai demo; dashboard tetap jalan dan jelas melabeli fixture.
4. API yang tersedia: `/api/health`, `/api/devices`, `/api/devices/26261652`, `/api/readings?serial=26261652&range=7d`, dan `/api/summary?range=24h`.

## Menyiapkan sumber real

Ikuti [docs/ANTARES_SETUP.md](./docs/ANTARES_SETUP.md) untuk mengisi konfigurasi lokal dan melakukan uji baca backend. Siapkan Supabase dan jalankan [supabase/migrations/001_init.sql](./supabase/migrations/001_init.sql). Hanya set `DEMO_MODE=false` setelah kredensial database dan ANTARES telah diuji. Dashboard tidak melakukan polling ANTARES untuk setiap pengunjung; gunakan sinkronisasi terjadwal yang terautentikasi. Jangan pernah mengisi AppKey LoRaWAN di aplikasi ini.

## Deploy publik

Ikuti [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md). Belum ada akun cloud, kredensial, repo GitHub, domain, atau deployment yang dibuat dari workspace ini. Jangan menyebut aplikasi live sebelum URL Vercel diuji dari perangkat/jaringan lain.

## Batasan PoC yang disengaja

- Dokumen `LORAWAN Water Meter Upload and Control Protocol.docx` tidak tersedia di workspace ini. Interpretasi field payload masih parsial.
- Backfill history memakai format daftar ID/content-instance yang didokumentasikan ANTARES, dibatasi 100 item per meter dan batch 5; perlu uji akun nyata dan pengaturan durasi function sebelum mengaktifkan di hosting.
- Webhook ANTARES mengembalikan HTTP 501 sampai format notifikasi dan pengamanan diuji dengan request sungguhan.
- Interval uplink meter bernilai `unknown`; status daring tidak disimpulkan dan debit agregat tidak dihitung sebagai nilai fresh.
- Belum ada autentikasi pengguna dashboard. Karena itu tabel Supabase tidak dapat dibaca langsung dari browser dan UI debug menampilkan hanya informasi telemetri yang sudah tersimpan. API route read memakai rate limit in-memory per instance; pada hosting multi-instance tambahkan rate limit platform/distributed store.
- Vercel Cron / scheduled sync perlu diaktifkan dan diuji setelah env real tersedia. Refresh UI 60 detik hanya memperbarui tampilan dari API aplikasi, bukan menjalankan sync publik ke ANTARES.

Migrasi backend ke Katara Green dijelaskan di [docs/MIGRATION_TO_KATARA.md](./docs/MIGRATION_TO_KATARA.md).
