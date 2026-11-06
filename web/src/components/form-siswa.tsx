"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PesanError } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { KABUPATEN } from "@/lib/schemas";
import type { SiswaData } from "@/lib/tipe";

const PEKERJAAN = [
  "Petani", "Buruh harian", "Nelayan", "Pekerja migran", "Tidak bekerja",
  "Pedagang", "Wiraswasta", "Karyawan swasta", "Pekerja pariwisata", "PNS/TNI/Polri",
];

type Nilai = Record<string, string>;

const KOSONG: Nilai = {
  nama: "", kelas: "", kabupaten: "", kehadiran_persen: "", rata_nilai: "", tren_nilai: "Stabil",
  jarak_km: "", waktu_tempuh_menit: "", penerima_bantuan: "Tidak", pekerjaan_ortu: "",
  status_tinggal: "Orang tua", ikut_bekerja: "Tidak", jumlah_saudara: "0",
  laporan_perundungan: "Tidak", jumlah_pelanggaran: "0", catatan_bk: "",
};

const ANGKA = ["kelas", "kehadiran_persen", "rata_nilai", "jarak_km", "waktu_tempuh_menit", "jumlah_saudara", "jumlah_pelanggaran"];

/** Form tambah/ubah siswa. Jika `awal` diisi, form dalam mode ubah. */
export function FormSiswa({ awal }: { awal?: SiswaData }) {
  const router = useRouter();
  const [nilai, setNilai] = useState<Nilai>(
    awal ? Object.fromEntries(Object.keys(KOSONG).map((k) => [k, String(awal[k as keyof SiswaData] ?? "")])) : KOSONG,
  );
  const [errorField, setErrorField] = useState<Record<string, string[]>>({});
  const [error, setError] = useState("");
  const [proses, setProses] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setNilai({ ...nilai, [k]: e.target.value });

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    setProses(true);
    setError("");
    setErrorField({});
    // Ubah teks angka menjadi number ("9,5" juga diterima)
    const data = Object.fromEntries(
      Object.entries(nilai).map(([k, v]) => [k, ANGKA.includes(k) ? (v === "" ? null : Number(v.replace(",", "."))) : v]),
    );
    try {
      const hasil = await api<SiswaData>(awal ? `/api/siswa/${awal.id}` : "/api/siswa", {
        method: awal ? "PUT" : "POST",
        json: data,
      });
      router.push(`/siswa/${hasil.id}`);
    } catch (e) {
      if (e instanceof ApiError && e.detail) {
        setErrorField(e.detail);
        setError(e.message + " Periksa kolom yang ditandai merah.");
      } else {
        setError(e instanceof ApiError ? e.message : "Gagal menyimpan.");
      }
      setProses(false);
    }
  }

  const salah = (k: string) => (errorField[k] ? "border-rose-500" : "");
  const pesan = (k: string) =>
    errorField[k] ? <p className="mt-1 text-xs text-rose-700">Nilai tidak valid</p> : null;

  const Teks = ({ k, label, tipe = "text", ...p }: { k: string; label: string; tipe?: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
    <div>
      <label htmlFor={k} className="label">{label}</label>
      <input id={k} type={tipe} className={`input ${salah(k)}`} value={nilai[k]} onChange={set(k)} {...p} />
      {pesan(k)}
    </div>
  );

  const Pilih = ({ k, label, opsi }: { k: string; label: string; opsi: string[] }) => (
    <div>
      <label htmlFor={k} className="label">{label}</label>
      <select id={k} className={`input ${salah(k)}`} value={nilai[k]} onChange={set(k)} required>
        <option value="" disabled>Pilih...</option>
        {opsi.map((o) => <option key={o}>{o}</option>)}
      </select>
      {pesan(k)}
    </div>
  );

  return (
    <form onSubmit={simpan} className="space-y-6">
      <fieldset className="kartu grid gap-4 sm:grid-cols-3">
        <legend className="px-1 text-sm font-semibold text-slate-800">Identitas</legend>
        {Teks({ k: "nama", label: "Nama (boleh inisial)", required: true, maxLength: 60 })}
        {Teks({ k: "kelas", label: "Kelas (7-12)", tipe: "number", min: 7, max: 12, required: true })}
        {Pilih({ k: "kabupaten", label: "Kabupaten/Kota", opsi: [...KABUPATEN] })}
      </fieldset>

      <fieldset className="kartu grid gap-4 sm:grid-cols-3">
        <legend className="px-1 text-sm font-semibold text-slate-800">Akademik</legend>
        {Teks({ k: "kehadiran_persen", label: "Kehadiran (%)", tipe: "number", min: 0, max: 100, step: "0.1", required: true })}
        {Teks({ k: "rata_nilai", label: "Rata-rata nilai (0-100)", tipe: "number", min: 0, max: 100, step: "0.1", required: true })}
        {Pilih({ k: "tren_nilai", label: "Tren nilai", opsi: ["Naik", "Stabil", "Turun"] })}
        {Teks({ k: "jumlah_pelanggaran", label: "Jumlah catatan pelanggaran", tipe: "number", min: 0, required: true })}
        {Pilih({ k: "laporan_perundungan", label: "Ada laporan perundungan?", opsi: ["Tidak", "Ya"] })}
      </fieldset>

      <fieldset className="kartu grid gap-4 sm:grid-cols-3">
        <legend className="px-1 text-sm font-semibold text-slate-800">Keluarga dan akses</legend>
        {Teks({ k: "jarak_km", label: "Jarak ke sekolah (km)", tipe: "number", min: 0, step: "0.1", required: true })}
        {Teks({ k: "waktu_tempuh_menit", label: "Waktu tempuh (menit)", tipe: "number", min: 0, required: true })}
        {Pilih({ k: "penerima_bantuan", label: "Penerima bantuan", opsi: ["Tidak", "KIP", "PKH"] })}
        <div>
          <label htmlFor="pekerjaan_ortu" className="label">Pekerjaan orang tua</label>
          <input id="pekerjaan_ortu" list="daftar-pekerjaan" className={`input ${salah("pekerjaan_ortu")}`}
            value={nilai.pekerjaan_ortu} onChange={set("pekerjaan_ortu")} required maxLength={60} />
          <datalist id="daftar-pekerjaan">{PEKERJAAN.map((p) => <option key={p} value={p} />)}</datalist>
          {pesan("pekerjaan_ortu")}
        </div>
        {Pilih({ k: "status_tinggal", label: "Tinggal bersama", opsi: ["Orang tua", "Kerabat", "Sendiri"] })}
        {Pilih({ k: "ikut_bekerja", label: "Siswa ikut bekerja?", opsi: ["Tidak", "Ya"] })}
        {Teks({ k: "jumlah_saudara", label: "Jumlah saudara", tipe: "number", min: 0, max: 20, required: true })}
      </fieldset>

      <fieldset className="kartu">
        <legend className="px-1 text-sm font-semibold text-slate-800">Catatan guru BK</legend>
        <textarea id="catatan_bk" className="input min-h-28" maxLength={2000} value={nilai.catatan_bk} onChange={set("catatan_bk")}
          placeholder="Contoh: sering izin karena membantu orang tua di kebun." aria-label="Catatan guru BK" />
        <p className="mt-1 text-xs text-slate-500">
          Catatan ini dibaca AI saat menyusun rekomendasi. Nama siswa disamarkan otomatis sebelum dikirim.
        </p>
      </fieldset>

      {error && <PesanError pesan={error} />}

      <div className="flex gap-3">
        <button className="tombol" disabled={proses}>{proses ? "Menyimpan..." : "Simpan dan hitung risiko"}</button>
        <button type="button" className="tombol-sekunder" onClick={() => router.back()}>Batal</button>
      </div>
    </form>
  );
}
