"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BadgeKategori, BarSkor, Memuat, PesanError } from "@/components/ui";
import { api } from "@/lib/api";
import type { Dashboard, Kategori, SiswaData } from "@/lib/tipe";

const KARTU: { kategori: Kategori; warna: string; ket: string }[] = [
  { kategori: "Tinggi", warna: "border-l-rose-600", ket: "skor ≥ 50, perlu ditangani segera" },
  { kategori: "Sedang", warna: "border-l-amber-500", ket: "skor 25-49, perlu dipantau" },
  { kategori: "Rendah", warna: "border-l-emerald-500", ket: "skor < 25" },
];

type Urut = "skor" | "nama" | "kelas" | "kehadiran";

export default function DashboardPage() {
  const [kelas, setKelas] = useState("");
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [urut, setUrut] = useState<Urut>("skor");

  useEffect(() => {
    api<Dashboard>(`/api/dashboard${kelas ? `?kelas=${kelas}` : ""}`)
      .then((d) => {
        setData(d);
        setError("");
      })
      .catch((e) => setError(e.message));
  }, [kelas]);

  const daftarTinggi = useMemo(() => {
    const d = [...(data?.berisiko_tinggi ?? [])];
    const banding: Record<Urut, (a: SiswaData, b: SiswaData) => number> = {
      skor: (a, b) => b.skor_risiko - a.skor_risiko,
      nama: (a, b) => a.nama.localeCompare(b.nama),
      kelas: (a, b) => a.kelas - b.kelas,
      kehadiran: (a, b) => a.kehadiran_persen - b.kehadiran_persen,
    };
    return d.sort(banding[urut]);
  }, [data, urut]);

  const maksFaktor = Math.max(1, ...(data?.faktor_terbanyak.map((f) => f.jumlah) ?? [1]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-slate-600">Ringkasan risiko putus sekolah siswa</p>
        </div>
        <div>
          <label htmlFor="kelas" className="label">Filter kelas</label>
          <select id="kelas" className="input w-40" value={kelas} onChange={(e) => setKelas(e.target.value)}>
            <option value="">Semua kelas</option>
            {data?.kelas_tersedia.map((k) => (
              <option key={k} value={k}>Kelas {k}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <PesanError pesan={error} />}
      {!data && !error && <Memuat />}

      {data && (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="kartu">
              <p className="text-sm text-slate-600">Total siswa</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums">{data.total}</p>
              <p className="mt-1 text-xs text-slate-500">
                Tindak lanjut: {data.tindak_lanjut.belum} belum · {data.tindak_lanjut.proses} proses · {data.tindak_lanjut.selesai} selesai
              </p>
            </div>
            {KARTU.map((k) => (
              <Link key={k.kategori} href={`/siswa?kategori=${k.kategori}${kelas ? `&kelas=${kelas}` : ""}`}
                className={`kartu border-l-4 ${k.warna} hover:bg-slate-50`}>
                <p className="text-sm text-slate-600">Risiko {k.kategori}</p>
                <p className="mt-1 text-3xl font-semibold tabular-nums">{data.per_kategori[k.kategori]}</p>
                <p className="mt-1 text-xs text-slate-500">{k.ket}</p>
              </Link>
            ))}
          </section>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            <section className="kartu self-start lg:col-span-2">
              <h2 className="font-semibold">Faktor penyebab paling sering</h2>
              <p className="mb-4 text-xs text-slate-500">Dari siswa berisiko Sedang dan Tinggi (hasil SHAP)</p>
              {data.faktor_terbanyak.length === 0 && <p className="text-sm text-slate-500">Belum ada data.</p>}
              <ul className="space-y-3">
                {data.faktor_terbanyak.map((f) => (
                  <li key={f.fitur}>
                    <div className="mb-1 flex justify-between gap-2 text-sm">
                      <span>{f.label}</span>
                      <span className="tabular-nums text-slate-600">{f.jumlah} siswa</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-teal-600" style={{ width: `${(f.jumlah / maksFaktor) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="kartu lg:col-span-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">Siswa berisiko tinggi ({daftarTinggi.length})</h2>
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  Urutkan
                  <select className="input w-auto py-1" value={urut} onChange={(e) => setUrut(e.target.value as Urut)}>
                    <option value="skor">Skor tertinggi</option>
                    <option value="kehadiran">Kehadiran terendah</option>
                    <option value="kelas">Kelas</option>
                    <option value="nama">Nama</option>
                  </select>
                </label>
              </div>
              {daftarTinggi.length === 0 ? (
                <p className="text-sm text-slate-500">Tidak ada siswa berisiko tinggi.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {daftarTinggi.map((s) => (
                    <li key={s.id}>
                      <Link href={`/siswa/${s.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:bg-slate-50">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{s.nama}</p>
                          <p className="truncate text-xs text-slate-500">
                            Kelas {s.kelas} · Hadir {s.kehadiran_persen}% · {s.faktor[0]?.penjelasan ?? "-"}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <BarSkor skor={s.skor_risiko} kategori={s.kategori} />
                          <span className="hidden sm:inline"><BadgeKategori kategori={s.kategori} /></span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
