import type { Siswa } from "@/lib/schemas";

export const SISWA_RAWAN: Siswa = {
  nama: "Komang Ayu", kelas: 10, kabupaten: "Karangasem",
  kehadiran_persen: 70, rata_nilai: 66, tren_nilai: "Turun",
  jarak_km: 11.5, waktu_tempuh_menit: 65, penerima_bantuan: "Tidak",
  pekerjaan_ortu: "Buruh harian", status_tinggal: "Kerabat",
  ikut_bekerja: "Ya", jumlah_saudara: 4, laporan_perundungan: "Tidak",
  jumlah_pelanggaran: 2,
  catatan_bk: "Komang sering izin karena membantu bekerja di kebun keluarga. Ada informasi keluarga merencanakan pernikahan dalam waktu dekat.",
};

export const SISWA_AMAN: Siswa = {
  nama: "Made Adi", kelas: 8, kabupaten: "Denpasar",
  kehadiran_persen: 97, rata_nilai: 86, tren_nilai: "Naik",
  jarak_km: 1.8, waktu_tempuh_menit: 10, penerima_bantuan: "Tidak",
  pekerjaan_ortu: "Karyawan swasta", status_tinggal: "Orang tua",
  ikut_bekerja: "Tidak", jumlah_saudara: 1, laporan_perundungan: "Tidak",
  jumlah_pelanggaran: 0, catatan_bk: "Siswa aktif di kelas.",
};

export const post = (url: string, body: unknown) =>
  new Request(`http://localhost${url}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
