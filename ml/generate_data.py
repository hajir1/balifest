"""
Generator data siswa SINTETIS untuk SiagaSekolah.

PENTING: Semua data di sini adalah buatan (sintetis). Tidak ada data pribadi asli.
Angka dan hubungan sebab-akibat disusun dari asumsi yang dijelaskan di
docs/data-sintetis.md, terinspirasi dari penyebab putus sekolah yang umum di Bali
(ekonomi, jarak/akses, keluarga/pernikahan dini, perundungan).

Cara pakai:
    python generate_data.py                 # 3000 siswa -> data/siswa_sintetis.csv
    python generate_data.py --n 5000 --seed 7

Alur sederhananya:
    1. Bangkitkan latar belakang siswa (kabupaten, ekonomi, keluarga, jarak).
    2. Dari latar belakang itu, bangkitkan perilaku sekolah (kehadiran, nilai, pelanggaran).
    3. Hitung "skor risiko tersembunyi" dari semua faktor (rumus logistik).
    4. Tentukan label putus_sekolah secara acak sesuai peluang dari skor itu.
"""

import argparse
from pathlib import Path

import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# Asumsi per kabupaten/kota
#   p_miskin   : peluang keluarga mengalami kesulitan ekonomi
#   jarak_median: median jarak rumah ke sekolah (km), makin pedesaan makin jauh
#   bobot      : proporsi siswa dalam data (mengikuti kira-kira jumlah penduduk)
# Buleleng dan Karangasem dibuat lebih rawan, sesuai data Dapodik yang
# mencatat angka putus sekolah tertinggi di dua kabupaten ini.
# ---------------------------------------------------------------------------
KABUPATEN = {
    #  nama          p_miskin  jarak_median  bobot
    "Buleleng":     (0.38, 5.0, 0.17),
    "Karangasem":   (0.42, 5.5, 0.12),
    "Bangli":       (0.32, 4.5, 0.06),
    "Jembrana":     (0.28, 4.0, 0.07),
    "Tabanan":      (0.22, 3.5, 0.10),
    "Klungkung":    (0.25, 3.5, 0.05),
    "Gianyar":      (0.18, 3.0, 0.12),
    "Badung":       (0.10, 2.5, 0.13),
    "Denpasar":     (0.08, 2.0, 0.18),
}

PEKERJAAN_MAMPU = ["Wiraswasta", "Karyawan swasta", "Pekerja pariwisata", "PNS/TNI/Polri", "Pedagang"]
PEKERJAAN_SULIT = ["Petani", "Buruh harian", "Nelayan", "Pekerja migran", "Tidak bekerja"]


def sigmoid(x):
    return 1 / (1 + np.exp(-x))


def generate(n: int, seed: int) -> pd.DataFrame:
    rng = np.random.default_rng(seed)

    # ----- 1. Latar belakang ------------------------------------------------
    nama_kab = list(KABUPATEN.keys())
    bobot = np.array([KABUPATEN[k][2] for k in nama_kab])
    kabupaten = rng.choice(nama_kab, size=n, p=bobot / bobot.sum())
    p_miskin = np.array([KABUPATEN[k][0] for k in kabupaten])
    jarak_median = np.array([KABUPATEN[k][1] for k in kabupaten])

    # Kelas 7-9 = SMP, 10-12 = SMA/SMK
    kelas = rng.integers(7, 13, size=n)
    jenjang = np.where(kelas <= 9, "SMP", rng.choice(["SMA", "SMK"], size=n, p=[0.55, 0.45]))

    ekonomi_sulit = rng.random(n) < p_miskin

    pekerjaan_ortu = np.where(
        ekonomi_sulit,
        rng.choice(PEKERJAAN_SULIT, size=n, p=[0.35, 0.30, 0.10, 0.15, 0.10]),
        rng.choice(PEKERJAAN_MAMPU, size=n, p=[0.25, 0.25, 0.25, 0.10, 0.15]),
    )

    # Bantuan: keluarga sulit lebih sering menerima KIP/PKH, tapi tidak semua
    # (mencerminkan data penerima bantuan yang belum tepat sasaran).
    u = rng.random(n)
    penerima_bantuan = np.where(
        ekonomi_sulit,
        np.where(u < 0.40, "KIP", np.where(u < 0.65, "PKH", "Tidak")),
        np.where(u < 0.06, "KIP", np.where(u < 0.09, "PKH", "Tidak")),
    )

    jumlah_saudara = rng.poisson(1.6 + 1.0 * ekonomi_sulit)

    # Status tinggal: anak pekerja migran lebih sering tinggal dengan kerabat;
    # siswa SMA/SMK yang jauh kadang kos/tinggal sendiri.
    p_kerabat = 0.08 + 0.10 * ekonomi_sulit + 0.40 * (pekerjaan_ortu == "Pekerja migran")
    p_sendiri = 0.02 + 0.06 * (kelas >= 10)
    u = rng.random(n)
    status_tinggal = np.where(u < p_kerabat, "Kerabat",
                              np.where(u < p_kerabat + p_sendiri, "Sendiri", "Orang tua"))

    # Jarak: distribusi lognormal (banyak yang dekat, sedikit yang sangat jauh)
    jarak_km = rng.lognormal(mean=np.log(jarak_median), sigma=0.6)
    jarak_km = np.clip(jarak_km, 0.2, 30).round(1)

    # Waktu tempuh: keluarga sulit lebih sering jalan kaki/menumpang (lebih lambat)
    menit_per_km = np.where(ekonomi_sulit, rng.uniform(4, 9, n), rng.uniform(2, 5, n))
    waktu_tempuh_menit = np.clip(jarak_km * menit_per_km + rng.normal(5, 3, n), 3, 150).round().astype(int)

    # Faktor tersembunyi (tidak menjadi kolom tabel, hanya muncul di catatan BK):
    # tekanan keluarga / rencana pernikahan dini, lebih sering di SMA/SMK dan keluarga sulit.
    tekanan_keluarga = rng.random(n) < (0.02 + 0.05 * (kelas >= 10) + 0.05 * ekonomi_sulit)

    # ----- 2. Perilaku sekolah ---------------------------------------------
    p_kerja = sigmoid(-3.2 + 1.8 * ekonomi_sulit + 0.25 * (kelas - 7) + 0.25 * jumlah_saudara)
    ikut_bekerja = rng.random(n) < p_kerja

    laporan_perundungan = rng.random(n) < 0.08

    kehadiran = (
        96
        - 9 * ikut_bekerja
        - 0.25 * np.maximum(waktu_tempuh_menit - 20, 0)  # makin lama perjalanan, makin sering absen
        - 6 * laporan_perundungan
        - 4 * (status_tinggal != "Orang tua")
        - 6 * tekanan_keluarga
        + rng.normal(0, 4, n)
    )
    kehadiran_persen = np.clip(kehadiran, 35, 100).round(1)

    rata_nilai = (
        60
        + 0.25 * kehadiran_persen
        - 3 * laporan_perundungan
        - 2 * ikut_bekerja
        + rng.normal(0, 6, n)
    )
    rata_nilai = np.clip(rata_nilai, 40, 98).round(1)

    # Tren nilai: siswa yang sedang tertekan lebih sering turun
    tekanan = 0.8 * ikut_bekerja + 0.9 * laporan_perundungan + 0.9 * tekanan_keluarga + 0.04 * (90 - kehadiran_persen)
    p_turun = sigmoid(-1.6 + tekanan)
    p_naik = 0.30 * (1 - p_turun)
    u = rng.random(n)
    tren_nilai = np.where(u < p_turun, "Turun", np.where(u < p_turun + p_naik, "Naik", "Stabil"))

    jumlah_pelanggaran = rng.poisson(np.clip(0.3 + 0.05 * (90 - kehadiran_persen) + 0.5 * laporan_perundungan, 0.1, None))

    # ----- 3. Skor risiko tersembunyi --------------------------------------
    # Setiap angka di bawah adalah asumsi "seberapa besar faktor ini menaikkan risiko".
    # Model ML nantinya harus bisa menemukan pola ini kembali dari data.
    bantuan = penerima_bantuan != "Tidak"
    logit = (
        -3.2
        + 0.10 * (90 - kehadiran_persen)              # kehadiran: faktor terkuat
        + 0.04 * (70 - rata_nilai)
        + 0.6 * (tren_nilai == "Turun")
        + 1.3 * ikut_bekerja
        + 0.9 * ekonomi_sulit * (~bantuan)            # miskin tanpa bantuan lebih rawan
        + 0.3 * ekonomi_sulit * bantuan               # bantuan mengurangi, tapi tidak menghapus risiko
        + 0.025 * np.maximum(waktu_tempuh_menit - 30, 0)
        + 0.6 * (status_tinggal == "Kerabat")
        + 0.8 * (status_tinggal == "Sendiri")
        + 0.12 * np.maximum(jumlah_saudara - 2, 0)
        + 0.7 * laporan_perundungan
        + 0.25 * jumlah_pelanggaran
        + 1.6 * tekanan_keluarga
        + 0.3 * (kelas >= 10)                          # transisi ke SMA/SMK lebih rawan
    )
    p_putus = sigmoid(logit)

    # ----- 4. Label ---------------------------------------------------------
    putus_sekolah = (rng.random(n) < p_putus).astype(int)

    catatan_bk = [
        buat_catatan(rng, ikut_bekerja[i], laporan_perundungan[i], tekanan_keluarga[i],
                     waktu_tempuh_menit[i], status_tinggal[i], pekerjaan_ortu[i], kehadiran_persen[i])
        for i in range(n)
    ]

    df = pd.DataFrame({
        "id_siswa": [f"S{i + 1:05d}" for i in range(n)],
        "nama": [buat_inisial(rng) for _ in range(n)],
        "jenjang": jenjang,
        "kelas": kelas,
        "kabupaten": kabupaten,
        "kehadiran_persen": kehadiran_persen,
        "rata_nilai": rata_nilai,
        "tren_nilai": tren_nilai,
        "jarak_km": jarak_km,
        "waktu_tempuh_menit": waktu_tempuh_menit,
        "penerima_bantuan": penerima_bantuan,
        "pekerjaan_ortu": pekerjaan_ortu,
        "status_tinggal": status_tinggal,
        "ikut_bekerja": np.where(ikut_bekerja, "Ya", "Tidak"),
        "jumlah_saudara": jumlah_saudara,
        "laporan_perundungan": np.where(laporan_perundungan, "Ya", "Tidak"),
        "jumlah_pelanggaran": jumlah_pelanggaran,
        "catatan_bk": catatan_bk,
        "putus_sekolah": putus_sekolah,
    })
    return df


def buat_inisial(rng) -> str:
    huruf = "ABCDEGHIKLMNPRSTWY"
    return f"{rng.choice(list(huruf))}.{rng.choice(list(huruf))}."


def buat_catatan(rng, kerja, bully, keluarga, waktu, tinggal, pekerjaan, hadir) -> str:
    """Catatan guru BK sintetis dari potongan kalimat sesuai kondisi siswa."""
    kalimat = []
    if kerja:
        kalimat.append(rng.choice([
            "Siswa membantu orang tua bekerja sepulang sekolah.",
            "Siswa sering izin karena ikut bekerja di kebun/warung keluarga.",
            "Siswa bekerja paruh waktu di sektor pariwisata pada akhir pekan.",
        ]))
    if bully:
        kalimat.append(rng.choice([
            "Ada laporan siswa diejek teman sekelas.",
            "Siswa tampak menarik diri setelah konflik dengan teman.",
            "Orang tua melaporkan anak enggan berangkat sekolah karena diganggu teman.",
        ]))
    if keluarga:
        kalimat.append(rng.choice([
            "Ada informasi keluarga merencanakan pernikahan siswa dalam waktu dekat.",
            "Orang tua menganggap sekolah tidak terlalu penting.",
            "Siswa mengurus adik karena orang tua bekerja di luar daerah.",
        ]))
    if waktu > 45:
        kalimat.append("Perjalanan ke sekolah jauh dan transportasi terbatas.")
    if tinggal == "Kerabat" and pekerjaan == "Pekerja migran":
        kalimat.append("Orang tua bekerja di luar negeri, siswa tinggal bersama kerabat.")
    if hadir < 75 and not kalimat:
        kalimat.append("Sering absen tanpa keterangan, belum diketahui penyebabnya.")
    if not kalimat:
        kalimat.append(rng.choice(["Tidak ada catatan khusus.", "Siswa aktif di kelas.", "-"]))
    return " ".join(kalimat)


def main():
    parser = argparse.ArgumentParser(description="Bangkitkan data siswa sintetis.")
    parser.add_argument("--n", type=int, default=3000, help="jumlah siswa (2000-5000 disarankan)")
    parser.add_argument("--seed", type=int, default=42, help="seed acak agar hasil bisa diulang")
    parser.add_argument("--out", type=Path, default=Path(__file__).parent / "data" / "siswa_sintetis.csv")
    args = parser.parse_args()

    df = generate(args.n, args.seed)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(args.out, index=False)

    print(f"Tersimpan: {args.out} ({len(df)} baris)")
    print(f"Proporsi putus sekolah: {df.putus_sekolah.mean():.1%}")
    print("\nProporsi putus sekolah per kabupaten:")
    print(df.groupby("kabupaten").putus_sekolah.mean().sort_values(ascending=False).map("{:.1%}".format).to_string())


if __name__ == "__main__":
    main()
