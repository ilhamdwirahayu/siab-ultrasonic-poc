# Panduan deployment Vercel + Supabase

Belum ada login cloud atau deployment yang dilakukan. Semua langkah cloud di bawah menunggu akun dan izin pemilik proyek.

## Persiapan lokal

1. Instal Node.js LTS, Git, dan VS Code.
2. Jika membuat ulang dari folder kosong: `npx create-next-app@latest siab-ultrasonic-poc --ts --tailwind --eslint --app --src-dir`.
3. Di root proyek jalankan `npm install`, `npm run test`, `npm run lint`, `npm run build`, lalu `npm run dev`.
4. Gunakan project Supabase yang ditetapkan untuk aplikasi; jalankan migrations sesuai urutan di `docs/SUPABASE_SETUP.md`.
5. Salin `.env.example` ke `.env.local`; masukkan URL project dan `SUPABASE_SECRET_KEY`, Access Key ANTARES, dan token sinkronisasi. Jangan commit `.env.local`.
6. Jalankan `Invoke-RestMethod http://localhost:3000/api/health`. Health harus menunjukkan status koneksi; uji `26261652` dengan `POST /api/sync` dan pastikan payload 43 byte ditemukan. Jangan set mode real jika tes ANTARES/Supabase gagal.

## GitHub dan Vercel

1. Buat repository GitHub private melalui UI GitHub.
2. Dari PowerShell root proyek:

   ```powershell
   git status
   git add .
   git commit -m "Build SIAB ultrasonic monitoring PoC"
   git remote add origin https://github.com/<akun>/<repo>.git
   git push -u origin main
   ```

3. Buka Vercel → **Add New → Project** → import repository private.
4. Project Settings → **Environment Variables**: isi `ANTARES_API_BASE_URL`, `ANTARES_APPLICATION`, `ANTARES_ACCESS_KEY`, `ANTARES_FRESHNESS_MINUTES`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `DEMO_MODE`, dan `INTERNAL_SYNC_TOKEN`.
5. Gunakan `DEMO_MODE=true` untuk demo fixture. Untuk real, jalankan migration dan verifikasi server outbound ke HTTPS port 8443 serta Supabase terlebih dahulu, baru ubah ke `false`.
6. Deploy. Vercel akan menyediakan URL `https://<project>.vercel.app`.
7. Tes dari ponsel pada jaringan seluler: dashboard, detail, report, `/api/health`. Matikan laptop dan pastikan data tersimpan tetap bisa dibaca.
8. Schedule sinkronisasi dengan Vercel Cron (atau scheduler tepercaya) ke `/api/sync` menggunakan Authorization secret. Periksa batas paket Vercel dan uji akses port 8443 dari region hosting. Jangan menyatakan histori unattended berjalan sebelum cron benar-benar terkonfirmasi.

### Cek keamanan sebelum publikasi

- Vercel Environment Variables hanya berisi server secrets tanpa prefix `NEXT_PUBLIC_` kecuali URL Supabase dan nama aplikasi.
- Browser DevTools Network/Sources tidak boleh menampilkan ANTARES access key atau Supabase secret.
- Uji `/api/sync` tanpa token (401), dalam mode demo (409), dan uji rate limit.
- Tabel `readings` tidak menyediakan policy SELECT untuk `anon`/`authenticated`.
- Tidak ada nama pelanggan maupun koordinat rumah pada seed.

Jika hosting tidak dapat mengakses port 8443, simpan dashboard publik dalam DEMO mode sampai tersedia relay/serverless job yang diizinkan. Jangan mengekspos ANTARES key, menaruh data ukur di localStorage, atau menjadikan laptop/ngrok satu-satunya sumber produksi.
