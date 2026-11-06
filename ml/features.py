"""
Mengubah data siswa (teks/angka dari form atau CSV) menjadi fitur angka untuk model ML.

Dipakai ml/train.py saat melatih model. Logika yang SAMA ditulis ulang di
web/src/lib/features.ts untuk memprediksi siswa baru di aplikasi.
Jika mengubah salah satu, ubah juga yang lain, lalu latih ulang model.

Catatan desain:
  - Setiap fitur sengaja dibuat mudah dijelaskan (angka asli atau 0/1),
    tanpa one-hot yang rumit, supaya hasil SHAP bisa langsung diterjemahkan
    ke kalimat untuk guru.
  - Kabupaten dan nama TIDAK dipakai sebagai fitur. Model tidak boleh menilai
    siswa lebih berisiko hanya karena asal daerahnya.
"""

PEKERJAAN_RENTAN = {"Petani", "Buruh harian", "Nelayan", "Pekerja migran", "Tidak bekerja"}

# Urutan kolom fitur. Model dilatih dengan urutan ini, jadi jangan diubah
# tanpa melatih ulang model.
FEATURES = [
    "kehadiran_persen",
    "rata_nilai",
    "tren_turun",
    "waktu_tempuh_menit",
    "jarak_km",
    "penerima_bantuan",
    "pekerjaan_ortu_rentan",
    "tinggal_bukan_ortu",
    "ikut_bekerja",
    "jumlah_saudara",
    "laporan_perundungan",
    "jumlah_pelanggaran",
    "jenjang_sma_smk",
]


def to_features(s: dict) -> list[float]:
    """Satu siswa (dict) -> list angka sesuai urutan FEATURES."""
    return [
        float(s["kehadiran_persen"]),
        float(s["rata_nilai"]),
        1.0 if s["tren_nilai"] == "Turun" else 0.0,
        float(s["waktu_tempuh_menit"]),
        float(s["jarak_km"]),
        1.0 if s["penerima_bantuan"] in ("KIP", "PKH") else 0.0,
        1.0 if s["pekerjaan_ortu"] in PEKERJAAN_RENTAN else 0.0,
        1.0 if s["status_tinggal"] != "Orang tua" else 0.0,
        1.0 if s["ikut_bekerja"] == "Ya" else 0.0,
        float(s["jumlah_saudara"]),
        1.0 if s["laporan_perundungan"] == "Ya" else 0.0,
        float(s["jumlah_pelanggaran"]),
        1.0 if int(s["kelas"]) >= 10 else 0.0,
    ]
