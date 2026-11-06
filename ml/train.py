"""
Melatih model prediksi risiko putus sekolah dari data sintetis, lalu
mengekspornya ke JSON agar bisa dipakai aplikasi Next.js (TypeScript).

Cara pakai:
    python train.py

Langkah:
    1. Baca data/siswa_sintetis.csv dan ubah menjadi 13 fitur angka (features.py).
    2. Bagi data: 80% latihan, 20% ujian.
    3. Latih Logistic Regression (model utama) dan Random Forest (pembanding).
    4. Ekspor Logistic Regression ke web/src/lib/model.json:
       bobot tiap fitur, intercept, dan rata-rata fitur (untuk SHAP).
    5. Cek bahwa rumus SHAP sederhana kita sama persis dengan library `shap`.

Kenapa Logistic Regression?
    - Prediksinya cukup dengan rumus: peluang = sigmoid(intercept + jumlah(bobot x fitur)).
      Rumus ini mudah ditulis ulang di TypeScript, jadi server tidak perlu Python.
    - SHAP untuk model linear punya rumus pasti: shap_i = bobot_i x (nilai_i - rata_rata_i).
    - Di data kita, hasilnya justru sedikit lebih baik dari Random Forest.
"""

import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (accuracy_score, confusion_matrix, f1_score,
                             precision_score, recall_score, roc_auc_score)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from features import FEATURES, to_features

HERE = Path(__file__).resolve().parent
DATA = HERE / "data" / "siswa_sintetis.csv"
MODEL_OUT = HERE.parent / "web" / "src" / "lib" / "model.json"
METRICS_OUT = HERE / "metrics.json"

THRESHOLD = 0.5  # = skor 50 = batas kategori "Tinggi" di aplikasi


def evaluasi(proba, y_test) -> dict:
    pred = (proba >= THRESHOLD).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_test, pred).ravel()
    return {
        "accuracy": round(accuracy_score(y_test, pred), 3),
        "precision": round(precision_score(y_test, pred), 3),
        "recall": round(recall_score(y_test, pred), 3),
        "f1": round(f1_score(y_test, pred), 3),
        "roc_auc": round(roc_auc_score(y_test, proba), 3),
        "confusion_matrix": {"TN": int(tn), "FP": int(fp), "FN": int(fn), "TP": int(tp)},
    }


def main():
    df = pd.read_csv(DATA)
    X = np.array([to_features(row) for row in df.to_dict(orient="records")])
    y = df["putus_sekolah"].values
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y)

    # --- Model utama: Logistic Regression -----------------------------------
    # StandardScaler menyamakan skala fitur agar training stabil.
    # class_weight="balanced" membuat model lebih memperhatikan siswa yang putus sekolah
    # (jumlahnya sedikit), sehingga recall lebih tinggi.
    lr = make_pipeline(StandardScaler(), LogisticRegression(class_weight="balanced", max_iter=1000))
    lr.fit(X_train, y_train)

    # --- Pembanding: Random Forest ------------------------------------------
    rf = RandomForestClassifier(n_estimators=300, max_depth=8, min_samples_leaf=5,
                                class_weight="balanced", random_state=42)
    rf.fit(X_train, y_train)

    hasil = {
        "LogisticRegression": evaluasi(lr.predict_proba(X_test)[:, 1], y_test),
        "RandomForest": evaluasi(rf.predict_proba(X_test)[:, 1], y_test),
    }
    for nama, m in hasil.items():
        print(f"\n== {nama} ==")
        for k, v in m.items():
            print(f"  {k}: {v}")

    # --- Ekspor ke JSON -----------------------------------------------------
    # Bobot dikembalikan ke skala asli fitur, supaya di TypeScript cukup:
    #   logit = intercept + sum(bobot_i * x_i)   (tanpa perlu scaler)
    scaler, model = lr[0], lr[1]
    bobot = model.coef_[0] / scaler.scale_
    intercept = float(model.intercept_[0] - np.sum(model.coef_[0] * scaler.mean_ / scaler.scale_))
    rata_rata = X_train.mean(axis=0)  # titik acuan SHAP = rata-rata data latih

    export = {
        "nama_model": "LogisticRegression",
        "fitur": FEATURES,
        "bobot": [round(float(b), 6) for b in bobot],
        "intercept": round(intercept, 6),
        "rata_rata": [round(float(m), 6) for m in rata_rata],
        "threshold": THRESHOLD,
        "metrik": hasil["LogisticRegression"],
    }
    MODEL_OUT.parent.mkdir(parents=True, exist_ok=True)
    MODEL_OUT.write_text(json.dumps(export, indent=2))
    print(f"\nModel tersimpan: {MODEL_OUT}")

    METRICS_OUT.write_text(json.dumps({
        "model_terpilih": "LogisticRegression",
        "threshold": THRESHOLD,
        "jumlah_data": {"train": len(y_train), "test": len(y_test)},
        "hasil": hasil,
    }, indent=2))
    print(f"Metrik tersimpan: {METRICS_OUT}")

    # --- Cek 1: rumus manual = sklearn ---------------------------------------
    logit = intercept + X_test @ bobot
    manual = 1 / (1 + np.exp(-logit))
    assert np.allclose(manual, lr.predict_proba(X_test)[:, 1], atol=1e-6)
    print("Cek: rumus manual sama dengan sklearn. OK")

    # --- Cek 2: rumus SHAP manual = library shap (jika terpasang) ------------
    try:
        import shap
        explainer = shap.LinearExplainer((bobot, intercept), shap.maskers.Independent(X_train, max_samples=len(X_train)))
        sv_lib = explainer.shap_values(X_test[:50])
        sv_manual = bobot * (X_test[:50] - rata_rata)
        assert np.allclose(sv_lib, sv_manual, atol=1e-6)
        print("Cek: SHAP manual sama dengan library shap. OK")
    except ImportError:
        print("(Library shap tidak terpasang, cek SHAP dilewati. Install: pip install shap)")


if __name__ == "__main__":
    main()
