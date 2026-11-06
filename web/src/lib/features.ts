/**
 * Mengubah data siswa (dari form/CSV) menjadi 13 fitur angka untuk model.
 *
 * Logika ini HARUS sama dengan ml/features.py (dipakai saat training).
 * Jika mengubah salah satu, ubah juga yang lain lalu latih ulang model.
 *
 * Kabupaten dan nama sengaja TIDAK dipakai sebagai fitur: model tidak boleh
 * menilai siswa lebih berisiko hanya karena asal daerahnya.
 */
import type { Siswa } from "./schemas";

const PEKERJAAN_RENTAN = new Set(["Petani", "Buruh harian", "Nelayan", "Pekerja migran", "Tidak bekerja"]);

export const FEATURES = [
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
] as const;

export type NamaFitur = (typeof FEATURES)[number];

/** Satu siswa -> array angka sesuai urutan FEATURES. */
export function toFeatures(s: Siswa): number[] {
  return [
    s.kehadiran_persen,
    s.rata_nilai,
    s.tren_nilai === "Turun" ? 1 : 0,
    s.waktu_tempuh_menit,
    s.jarak_km,
    s.penerima_bantuan === "KIP" || s.penerima_bantuan === "PKH" ? 1 : 0,
    PEKERJAAN_RENTAN.has(s.pekerjaan_ortu) ? 1 : 0,
    s.status_tinggal !== "Orang tua" ? 1 : 0,
    s.ikut_bekerja === "Ya" ? 1 : 0,
    s.jumlah_saudara,
    s.laporan_perundungan === "Ya" ? 1 : 0,
    s.jumlah_pelanggaran,
    s.kelas >= 10 ? 1 : 0,
  ];
}

/** Menerjemahkan fitur yang menaikkan risiko menjadi kalimat untuk guru. */
export function jelaskanFaktor(fitur: NamaFitur, s: Siswa): string {
  switch (fitur) {
    case "kehadiran_persen":
      return `Kehadiran rendah (${Math.round(s.kehadiran_persen)}%)`;
    case "rata_nilai":
      return `Rata-rata nilai rendah (${Math.round(s.rata_nilai)})`;
    case "tren_turun":
      return "Nilai sedang menurun";
    case "waktu_tempuh_menit":
      return `Waktu tempuh ke sekolah lama (${s.waktu_tempuh_menit} menit)`;
    case "jarak_km":
      return `Jarak rumah ke sekolah jauh (${s.jarak_km} km)`;
    case "penerima_bantuan":
      return s.penerima_bantuan === "Tidak"
        ? "Belum menerima bantuan pendidikan (KIP/PKH)"
        : `Keluarga penerima bantuan ${s.penerima_bantuan} (indikasi ekonomi sulit)`;
    case "pekerjaan_ortu_rentan":
      return `Pekerjaan orang tua tidak tetap (${s.pekerjaan_ortu})`;
    case "tinggal_bukan_ortu":
      return `Tidak tinggal bersama orang tua (${s.status_tinggal})`;
    case "ikut_bekerja":
      return "Siswa ikut bekerja";
    case "jumlah_saudara":
      return `Jumlah saudara banyak (${s.jumlah_saudara})`;
    case "laporan_perundungan":
      return "Ada laporan perundungan";
    case "jumlah_pelanggaran":
      return `Sering melakukan pelanggaran (${s.jumlah_pelanggaran} catatan)`;
    case "jenjang_sma_smk":
      return "Berada di jenjang SMA/SMK (masa rawan putus sekolah)";
  }
}

export type Kategori = "Rendah" | "Sedang" | "Tinggi";

/** Kategori risiko dari skor 0-100. */
export function kategoriRisiko(skor: number): Kategori {
  if (skor >= 50) return "Tinggi";
  if (skor >= 25) return "Sedang";
  return "Rendah";
}
