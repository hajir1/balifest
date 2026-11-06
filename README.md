# SiagaSekolah

> Sistem peringatan dini putus sekolah untuk guru BK dan wali kelas SMP/SMA/SMK di Bali.
> Dibuat untuk AI Web Innovation Challenge (AIWIC) Bali DigiFest 2026, kategori Mahasiswa.

**Status: dalam pengerjaan (Tahap A-E selesai).** README lengkap disusun di Tahap G.

## Description

Guru memasukkan data siswa, model machine learning memprediksi risiko putus sekolah beserta faktor penyebab utamanya, lalu LLM menyusun rekomendasi intervensi dan draf pesan ke orang tua dalam Bahasa Indonesia.

## Problem & Target User

Sekitar 28.201 anak putus sekolah di Provinsi Bali (Dapodik), tertinggi di Buleleng dan Karangasem. Sekolah sering baru bertindak setelah siswa berhenti. Pengguna: guru BK, wali kelas, dan kepala sekolah.

## Struktur repository

```
web/    Aplikasi Next.js (TypeScript + Tailwind): halaman web + API (/api/predict, /api/recommend)
ml/     Python: generator data sintetis dan training model (hanya dijalankan di laptop)
docs/   Dokumentasi (asumsi data, model, LLM, AI disclosure)
```

Alur: `ml/train.py` (sekali, di laptop) -> `web/src/lib/model.json` -> aplikasi Next.js di Vercel.

## Data

Semua data adalah **sintetis** (lihat [docs/data-sintetis.md](docs/data-sintetis.md)). Model harus dilatih ulang dengan data riil sekolah sebelum dipakai sungguhan.

## Menjalankan (sementara, PowerShell)

```
# 1. (Opsional) Data sintetis dan training model ulang
cd ml
pip install -r requirements.txt
python generate_data.py
python train.py

# 2. Aplikasi web
cd ..\web
npm install
copy .env.example .env.local     # isi DEMO_USERNAME, DEMO_PASSWORD, GEMINI_API_KEY
npm test
npm run dev                      # http://localhost:3000
```

- Halaman, API, dan cara deploy: [web/README.md](web/README.md)
- Detail model dan metrik evaluasi: [docs/model.md](docs/model.md)
- Cara kerja rekomendasi LLM dan cadangannya: [docs/llm.md](docs/llm.md)

<!-- Bagian berikut dilengkapi di Tahap G:
Key Features, Tech Stack, AI Implementation, Architecture / Data Flow,
Installation / Run Instructions, Deployment URL, Demo Account,
Known Limitations, Third-party Resources / Credits, Team Members -->
