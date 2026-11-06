# SiagaSekolah Web (Next.js)

Frontend dan backend (API routes) dalam satu aplikasi Next.js, di-deploy ke Vercel.

## Menjalankan lokal (PowerShell)

```
cd web
npm install
copy .env.example .env.local
```

Isi minimal di `.env.local`:

```
DEMO_USERNAME=guru
DEMO_PASSWORD=passwordmu
GEMINI_API_KEY=...        # opsional; tanpa ini rekomendasi memakai cadangan rule-based
```

Lalu:

```
npm test                  # 36 tes otomatis
npm run dev               # buka http://localhost:3000
```

Database lokal dibuat otomatis (PGlite, di folder `web/.data`) dan langsung diisi 40 siswa contoh sintetis. Untuk mengulang dari awal, hapus folder `.data`.

## Deploy ke Vercel

1. Push repo ke GitHub, lalu di Vercel: **Add New → Project → pilih repo**, set **Root Directory = `web`**.
2. **Storage → Create Database → Neon (Postgres)** lalu hubungkan ke project. `DATABASE_URL` terisi otomatis.
3. **Settings → Environment Variables**: `AUTH_SECRET`, `DEMO_USERNAME`, `DEMO_PASSWORD`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_THINKING_LEVEL`.
4. Deploy. Tabel database dibuat otomatis saat pertama kali diakses.

## Halaman

| Halaman | Isi |
|---|---|
| `/login` | Login guru (akun dari env) |
| `/dashboard` | Jumlah siswa per kategori, grafik faktor penyebab, daftar risiko tinggi (bisa diurutkan), filter kelas |
| `/siswa` | Daftar siswa + filter/cari/urut, import CSV, unduh template |
| `/siswa/baru`, `/siswa/[id]/edit` | Form tambah/ubah siswa |
| `/siswa/[id]` | Skor risiko, 3 faktor (SHAP), rekomendasi AI + draf pesan WA, disclaimer, riwayat tindak lanjut |

## API

Semua API (kecuali login dan health) wajib login.

| Endpoint | Fungsi |
|---|---|
| `POST /api/auth/login`, `POST /api/auth/logout` | Masuk/keluar (cookie httpOnly berisi JWT) |
| `GET /api/health` | Status server, model, dan apakah Gemini aktif |
| `GET, POST /api/siswa` | Daftar (filter `kelas`, `kategori`, `cari`, `urut`) / tambah siswa |
| `GET, PUT, DELETE /api/siswa/[id]` | Detail / ubah / hapus siswa |
| `POST /api/siswa/[id]/rekomendasi` | Rekomendasi Gemini (disimpan) atau cadangan rule-based |
| `GET, POST /api/siswa/[id]/tindak-lanjut` | Riwayat / tambah tindakan |
| `PATCH, DELETE /api/tindak-lanjut/[id]` | Ubah status / hapus tindakan |
| `POST /api/siswa/import` | Upload CSV (form-data `file`) |
| `GET /api/siswa/template` | Unduh template CSV |
| `GET /api/dashboard` | Data dashboard (`?kelas=10`) |
| `POST /api/predict`, `POST /api/recommend` | Prediksi/rekomendasi tanpa menyimpan (untuk uji di Postman) |

## File penting

- `src/lib/model.json`: model Logistic Regression hasil `ml/train.py`
- `src/lib/features.ts`, `src/lib/predictor.ts`: fitur, rumus prediksi, dan SHAP
- `src/lib/recommender.ts`: Gemini, anonimisasi, fallback, batas request
- `src/lib/db.ts`: koneksi Postgres/PGlite dan pembuatan tabel
- `src/lib/siswa.ts`: query data siswa, dashboard, tindak lanjut
- `src/lib/auth.ts`, `src/proxy.ts`: login dan proteksi halaman
- `src/lib/csv.ts`: import CSV
