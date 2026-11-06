"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { BadgeKategori, BarSkor, Memuat, PesanError } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { SiswaData } from "@/lib/tipe";

type HasilImport = { berhasil: number; gagal: { baris: number; pesan: string }[] };

export function DaftarSiswa() {
  // Filter awal dari URL (misalnya dari kartu di dashboard: /siswa?kategori=Tinggi)
  const q = useSearchParams();
  const [filter, setFilter] = useState({
    kelas: q.get("kelas") ?? "",
    kategori: q.get("kategori") ?? "",
    cari: "",
    urut: "skor_desc",
  });
  const [siswa, setSiswa] = useState<SiswaData[] | null>(null);
  const [error, setError] = useState("");
  const [hasilImport, setHasilImport] = useState<HasilImport | null>(null);
  const [errorImport, setErrorImport] = useState("");
  const [mengimpor, setMengimpor] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const muat = useCallback(() => {
    const q = new URLSearchParams(Object.entries(filter).filter(([, v]) => v));
    api<SiswaData[]>(`/api/siswa?${q}`)
      .then((d) => {
        setSiswa(d);
        setError("");
      })
      .catch((e) => setError(e.message));
  }, [filter]);

  useEffect(() => {
    const t = setTimeout(muat, 250); // tunggu sebentar saat mengetik pencarian
    return () => clearTimeout(t);
  }, [muat]);

  async function impor(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return setErrorImport("Pilih file CSV terlebih dahulu.");
    setMengimpor(true);
    setErrorImport("");
    setHasilImport(null);
    try {
      const form = new FormData();
      form.append("file", file);
      setHasilImport(await api<HasilImport>("/api/siswa/import", { method: "POST", body: form }));
      if (fileRef.current) fileRef.current.value = "";
      muat();
    } catch (e) {
      setErrorImport(e instanceof ApiError ? e.message : "Import gagal.");
    } finally {
      setMengimpor(false);
    }
  }

  const ubah = (k: keyof typeof filter) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFilter({ ...filter, [k]: e.target.value });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Data Siswa</h1>
          <p className="text-sm text-slate-600">Skor risiko dihitung otomatis oleh model ML setiap data disimpan.</p>
        </div>
        <Link href="/siswa/baru" className="tombol">+ Tambah siswa</Link>
      </div>

      <details className="kartu">
        <summary className="cursor-pointer font-medium">Import banyak siswa dari CSV</summary>
        <form onSubmit={impor} className="mt-4 space-y-3">
          <p className="text-sm text-slate-600">
            Unduh template, isi di Excel/Google Sheets, simpan sebagai CSV, lalu upload. Maksimal 1.000 baris.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <a href="/api/siswa/template" download className="tombol-sekunder">Unduh template CSV</a>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="text-sm" aria-label="File CSV" />
            <button className="tombol" disabled={mengimpor}>{mengimpor ? "Mengimpor..." : "Upload"}</button>
          </div>
          {errorImport && <PesanError pesan={errorImport} />}
          {hasilImport && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              {hasilImport.berhasil} siswa berhasil ditambahkan.
              {hasilImport.gagal.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-rose-800">
                  {hasilImport.gagal.slice(0, 10).map((g) => (
                    <li key={g.baris}>Baris {g.baris}: {g.pesan}</li>
                  ))}
                  {hasilImport.gagal.length > 10 && <li>...dan {hasilImport.gagal.length - 10} baris lain</li>}
                </ul>
              )}
            </div>
          )}
        </form>
      </details>

      <div className="grid gap-3 sm:grid-cols-4">
        <input className="input" placeholder="Cari nama..." value={filter.cari} onChange={ubah("cari")} aria-label="Cari nama" />
        <select className="input" value={filter.kelas} onChange={ubah("kelas")} aria-label="Kelas">
          <option value="">Semua kelas</option>
          {[7, 8, 9, 10, 11, 12].map((k) => <option key={k} value={k}>Kelas {k}</option>)}
        </select>
        <select className="input" value={filter.kategori} onChange={ubah("kategori")} aria-label="Kategori">
          <option value="">Semua kategori</option>
          <option>Tinggi</option>
          <option>Sedang</option>
          <option>Rendah</option>
        </select>
        <select className="input" value={filter.urut} onChange={ubah("urut")} aria-label="Urutkan">
          <option value="skor_desc">Skor tertinggi</option>
          <option value="skor_asc">Skor terendah</option>
          <option value="nama">Nama A-Z</option>
          <option value="kelas">Kelas</option>
          <option value="terbaru">Terbaru ditambahkan</option>
        </select>
      </div>

      {error && <PesanError pesan={error} />}
      {!siswa && !error && <Memuat />}

      {siswa && (
        <div className="kartu overflow-hidden p-0 sm:p-0">
          <p className="border-b border-slate-100 px-4 py-2 text-sm text-slate-600">{siswa.length} siswa</p>
          {siswa.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">Tidak ada siswa yang cocok dengan filter.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Nama</th>
                    <th className="px-4 py-2">Kelas</th>
                    <th className="hidden px-4 py-2 md:table-cell">Kehadiran</th>
                    <th className="hidden px-4 py-2 lg:table-cell">Faktor utama</th>
                    <th className="px-4 py-2">Skor</th>
                    <th className="hidden px-4 py-2 sm:table-cell">Kategori</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {siswa.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5">
                        <Link href={`/siswa/${s.id}`} className="font-medium text-teal-800 hover:underline">{s.nama}</Link>
                        <p className="text-xs text-slate-500">{s.kabupaten}</p>
                      </td>
                      <td className="px-4 py-2.5">{s.kelas}</td>
                      <td className="hidden px-4 py-2.5 tabular-nums md:table-cell">{s.kehadiran_persen}%</td>
                      <td className="hidden px-4 py-2.5 text-slate-600 lg:table-cell">{s.faktor[0]?.penjelasan ?? "-"}</td>
                      <td className="px-4 py-2.5"><BarSkor skor={s.skor_risiko} kategori={s.kategori} /></td>
                      <td className="hidden px-4 py-2.5 sm:table-cell"><BadgeKategori kategori={s.kategori} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
