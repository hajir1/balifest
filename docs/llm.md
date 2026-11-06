# Rekomendasi Intervensi dengan LLM (Gemini)

File utama: `web/src/lib/recommender.ts`. Endpoint: `POST /api/recommend`.

## Alur

```
Data siswa -> model ML (skor + 3 faktor SHAP)
           -> data dianonimkan (tanpa nama/NISN)
           -> Gemini (structured output JSON)
           -> divalidasi Zod
              |- valid  -> tampilkan (sumber: "gemini")
              |- gagal  -> rekomendasi rule-based (sumber: "aturan") + pesan peringatan
           -> selalu disertai disclaimer
```

## Yang dikirim ke Gemini

Hanya: ID anonim (hash), kelas, kabupaten, skor, kategori, kalimat faktor penyebab, status bantuan, status tinggal, dan catatan guru BK yang sudah dibersihkan.

- Nama siswa **tidak** dikirim. Jika nama muncul di catatan guru, nama itu diganti `[siswa]`.
- Angka 8 digit atau lebih (NISN, nomor HP) diganti `[angka disamarkan]`.

## Output yang diminta (structured output)

```json
{
  "ringkasan": "2-3 kalimat kondisi siswa",
  "rekomendasi": [{"tindakan": "...", "alasan": "..."}],
  "pesan_orang_tua": "draf pesan WhatsApp untuk orang tua/wali"
}
```

Skema JSON dikirim ke Gemini (`responseJsonSchema`) sehingga Gemini wajib menjawab dalam format ini. Jawabannya tetap divalidasi ulang dengan Zod (3-5 rekomendasi, panjang teks wajar) sebelum ditampilkan.

## Keandalan

| Kondisi | Yang terjadi |
|---|---|
| `GEMINI_API_KEY` kosong | Rekomendasi rule-based + pesan "Layanan AI belum dikonfigurasi" |
| Timeout (default 45 detik), jaringan putus, kuota habis, API key salah | Rekomendasi rule-based + pesan "Layanan AI sedang tidak dapat dihubungi" |
| JSON dari Gemini rusak/tidak sesuai | Rekomendasi rule-based + pesan "Jawaban AI tidak sesuai format" |
| Lebih dari `LLM_MAX_REQUESTS_PER_HOUR` request per jam (default 60) | Rekomendasi rule-based + pesan "Batas penggunaan AI per jam tercapai" |
| Data siswa sama diminta lagi | Jawaban diambil dari cache, tidak memanggil Gemini lagi |

Catatan: di Vercel, cache dan batas request disimpan di memori tiap instance server, jadi bisa ter-reset saat server dimulai ulang.

Rekomendasi rule-based memetakan setiap faktor SHAP ke tindakan (misalnya ikut bekerja -> cek PIP/KIP) dan membaca kata kunci di catatan guru (misalnya "pernikahan" -> pendekatan keluarga dan tokoh adat).

## Disclaimer

Setiap jawaban `/api/recommend` berisi: *"Hasil ini adalah alat bantu, bukan keputusan akhir. Keputusan tetap di tangan guru BK."* Frontend wajib menampilkannya.

## Konfigurasi (`web/.env.local`, atau Environment Variables di Vercel)

```
GEMINI_API_KEY=...            # dari https://aistudio.google.com/apikey
GEMINI_MODEL=gemini-3.8-flash # model Flash dengan free tier
LLM_TIMEOUT_SECONDS=45
GEMINI_THINKING_LEVEL=low
LLM_MAX_REQUESTS_PER_HOUR=60
```
