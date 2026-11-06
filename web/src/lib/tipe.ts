/** Tipe data yang dipakai halaman (sama dengan yang dikirim API). */
import type { Faktor } from "./predictor";
import type { HasilRekomendasi } from "./recommender";
import type { Siswa } from "./schemas";

export type Kategori = "Rendah" | "Sedang" | "Tinggi";

export type SiswaData = Siswa & {
  id: number;
  skor_risiko: number;
  kategori: Kategori;
  faktor: Faktor[];
  rekomendasi?: HasilRekomendasi | null;
  rekomendasi_at?: string | null;
  ada_rekomendasi?: boolean;
  updated_at: string;
};

export type TindakLanjut = {
  id: number;
  siswa_id: number;
  tindakan: string;
  catatan: string;
  status: "belum" | "proses" | "selesai";
  tanggal: string;
};

export type Dashboard = {
  total: number;
  per_kategori: Record<Kategori, number>;
  faktor_terbanyak: { fitur: string; label: string; jumlah: number }[];
  berisiko_tinggi: SiswaData[];
  kelas_tersedia: number[];
  tindak_lanjut: { belum: number; proses: number; selesai: number };
};

export type { HasilRekomendasi };
