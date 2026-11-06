# Model ML: Prediksi Risiko Putus Sekolah

## Ringkasnya

1. `ml/train.py` membaca data sintetis, mengubahnya jadi 13 fitur angka (`ml/features.py`), lalu membagi 80% data latih dan 20% data uji.
2. Model utama: **Logistic Regression**. Random Forest dilatih juga sebagai pembanding.
3. Model diekspor ke `web/src/lib/model.json`: bobot tiap fitur, intercept, dan rata-rata fitur. Aplikasi Next.js menghitung prediksi dari file ini, jadi **server tidak perlu Python**.
4. Untuk setiap siswa, **SHAP** menghitung kontribusi tiap fitur. Tiga fitur yang paling menaikkan risiko ditampilkan sebagai faktor penyebab, misalnya "Kehadiran rendah (70%)".

## Rumus (di `web/src/lib/predictor.ts`)

```
logit   = intercept + Σ (bobot_i × x_i)
peluang = 1 / (1 + e^(-logit))            -> skor risiko = peluang × 100
shap_i  = bobot_i × (x_i − rata_rata_i)   -> > 0 berarti menaikkan risiko
```

Untuk model linear, rumus SHAP ini adalah nilai SHAP yang **pasti** (bukan perkiraan). `ml/train.py` mengecek bahwa hasilnya sama persis dengan library `shap` (`LinearExplainer`). Nilai `kontribusi` di API dalam satuan log-odds.

## Fitur yang dipakai

kehadiran, rata-rata nilai, tren nilai turun, waktu tempuh, jarak, penerima bantuan, pekerjaan orang tua tidak tetap, tidak tinggal dengan orang tua, ikut bekerja, jumlah saudara, laporan perundungan, jumlah pelanggaran, jenjang SMA/SMK.

**Tidak dipakai:** nama dan kabupaten. Model tidak boleh menilai siswa lebih berisiko hanya karena asal daerahnya. Catatan guru BK (teks) juga tidak masuk model ML; teks itu dibaca LLM.

## Hasil evaluasi (data uji 600 siswa, ambang skor 50)

| Metrik | Logistic Regression (dipilih) | Random Forest |
|---|---|---|
| Accuracy | 0,815 | 0,820 |
| Precision | 0,442 | 0,446 |
| Recall | **0,793** | 0,717 |
| F1 | **0,568** | 0,550 |
| ROC-AUC | **0,882** | 0,871 |

Confusion matrix Logistic Regression:

| | Prediksi tidak putus | Prediksi putus |
|---|---|---|
| **Aktual tidak putus** | 416 (TN) | 92 (FP) |
| **Aktual putus** | 19 (FN) | 73 (TP) |

### Kenapa Logistic Regression?

- **Recall paling tinggi (79%)**. Untuk peringatan dini, lebih baik guru mengecek beberapa siswa yang ternyata aman (false positive) daripada melewatkan siswa yang benar-benar akan putus sekolah (false negative).
- **Transparan**: setiap bobot bisa dibaca langsung ("kehadiran turun 1% menaikkan risiko sebesar ..."), dan SHAP-nya pasti.
- **Ringan**: model hanya 13 angka bobot, bisa dijalankan di TypeScript/serverless tanpa server Python.

`class_weight="balanced"` membuat model lebih memperhatikan kasus putus sekolah yang jumlahnya sedikit. Akibatnya skor risiko adalah **skor peringkat**, bukan peluang persis.

### Batas kategori

- Rendah: skor < 25
- Sedang: 25-49
- Tinggi: >= 50

## Keterbatasan

- Dilatih dengan data sintetis. **Wajib dilatih ulang dengan data riil sekolah** sebelum dipakai sungguhan.
- Model linear tidak menangkap interaksi rumit antar faktor; di data ini tidak masalah, tapi perlu dicek ulang dengan data riil.

## Menjalankan ulang (PowerShell)

```
cd ml
pip install -r requirements.txt
python generate_data.py
python train.py        # menulis web/src/lib/model.json dan ml/metrics.json
```
