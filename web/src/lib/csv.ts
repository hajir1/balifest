/**
 * Import data siswa dari file CSV.
 * Baris yang valid disimpan; baris yang tidak valid dilaporkan beserta nomor barisnya.
 */
import Papa from "papaparse";
import { z } from "zod";
import { SiswaSchema, type Siswa } from "./schemas";

export const KOLOM_CSV = [
  "nama", "kelas", "kabupaten", "kehadiran_persen", "rata_nilai", "tren_nilai",
  "jarak_km", "waktu_tempuh_menit", "penerima_bantuan", "pekerjaan_ortu",
  "status_tinggal", "ikut_bekerja", "jumlah_saudara", "laporan_perundungan",
  "jumlah_pelanggaran", "catatan_bk",
] as const;

const KOLOM_ANGKA = new Set([
  "kelas", "kehadiran_persen", "rata_nilai", "jarak_km",
  "waktu_tempuh_menit", "jumlah_saudara", "jumlah_pelanggaran",
]);

export const MAKS_BARIS = 1000;

export const TEMPLATE_CSV =
  KOLOM_CSV.join(",") +
  "\n" +
  'W.S.,10,Karangasem,72,68,Turun,9.5,60,Tidak,Buruh harian,Kerabat,Ya,4,Tidak,2,"Sering izin membantu orang tua di kebun."\n' +
  "K.A.,8,Denpasar,96,85,Stabil,2,10,KIP,Pedagang,Orang tua,Tidak,1,Tidak,0,\n";

export type HasilParse = {
  valid: Siswa[];
  gagal: { baris: number; pesan: string }[];
  error?: string;
};

export function parseCsv(teks: string): HasilParse {
  const hasil = Papa.parse<Record<string, string>>(teks.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim().toLowerCase(),
    // Excel versi Indonesia sering memakai titik koma sebagai pemisah
    delimitersToGuess: [",", ";", "\t"],
  });

  const kolomHilang = KOLOM_CSV.filter((k) => k !== "catatan_bk" && k !== "jumlah_pelanggaran")
    .filter((k) => !hasil.meta.fields?.includes(k));
  if (kolomHilang.length) {
    return { valid: [], gagal: [], error: `Kolom wajib tidak ditemukan: ${kolomHilang.join(", ")}. Gunakan template CSV.` };
  }
  if (hasil.data.length > MAKS_BARIS) {
    return { valid: [], gagal: [], error: `Maksimal ${MAKS_BARIS} baris per file.` };
  }

  const valid: Siswa[] = [];
  const gagal: HasilParse["gagal"] = [];

  hasil.data.forEach((baris, i) => {
    const obj: Record<string, unknown> = {};
    for (const k of KOLOM_CSV) {
      const v = (baris[k] ?? "").trim();
      if (KOLOM_ANGKA.has(k)) {
        // terima koma desimal ala Indonesia: "9,5" -> 9.5
        obj[k] = v === "" ? (k === "jumlah_pelanggaran" ? 0 : undefined) : Number(v.replace(",", "."));
      } else {
        obj[k] = v;
      }
    }
    const cek = SiswaSchema.safeParse(obj);
    if (cek.success) valid.push(cek.data);
    else {
      const pesan = Object.entries(z.flattenError(cek.error).fieldErrors)
        .map(([kolom]) => kolom)
        .join(", ");
      gagal.push({ baris: i + 2, pesan: `Nilai tidak valid di kolom: ${pesan}` }); // +2: header + mulai dari 1
    }
  });

  return { valid, gagal };
}
