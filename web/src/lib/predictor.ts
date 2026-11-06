/**
 * Prediksi risiko putus sekolah + faktor penyebab (SHAP).
 *
 * Model = Logistic Regression yang dilatih di ml/train.py dan diekspor ke model.json.
 *
 *   logit   = intercept + sum(bobot_i * x_i)
 *   peluang = 1 / (1 + e^-logit)          -> skor 0-100
 *   shap_i  = bobot_i * (x_i - rata_rata_i)
 *
 * shap_i > 0 berarti fitur itu MENAIKKAN risiko siswa ini dibanding rata-rata siswa.
 * Rumus SHAP ini sudah dicek sama persis dengan library `shap` (lihat ml/train.py).
 */
import model from "./model.json";
import { FEATURES, jelaskanFaktor, kategoriRisiko, toFeatures, type Kategori, type NamaFitur } from "./features";
import type { Siswa } from "./schemas";

export type Faktor = { fitur: NamaFitur; penjelasan: string; kontribusi: number };
export type Prediksi = { skor_risiko: number; kategori: Kategori; faktor_teratas: Faktor[]; model: string };

if (JSON.stringify(model.fitur) !== JSON.stringify(FEATURES)) {
  throw new Error("Fitur di model.json tidak cocok dengan features.ts. Latih ulang model (ml/train.py).");
}

const round = (x: number, d = 1) => Math.round(x * 10 ** d) / 10 ** d;

export function predict(siswa: Siswa, topN = 3): Prediksi {
  const x = toFeatures(siswa);

  const logit = x.reduce((total, xi, i) => total + model.bobot[i] * xi, model.intercept);
  const skor = (1 / (1 + Math.exp(-logit))) * 100;

  const shap = x.map((xi, i) => model.bobot[i] * (xi - model.rata_rata[i]));

  const faktor = FEATURES.map((fitur, i) => ({ fitur, shap: shap[i] }))
    .filter((f) => f.shap > 0.05) // hanya yang benar-benar menaikkan risiko
    .sort((a, b) => b.shap - a.shap)
    .slice(0, topN)
    .map((f) => ({
      fitur: f.fitur,
      penjelasan: jelaskanFaktor(f.fitur, siswa),
      kontribusi: round(f.shap, 2), // dalam satuan log-odds
    }));

  return {
    skor_risiko: round(skor),
    kategori: kategoriRisiko(skor),
    faktor_teratas: faktor,
    model: model.nama_model,
  };
}
