"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { BadgeKategori, Disclaimer, Memuat, PesanError } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { HasilRekomendasi, SiswaData, TindakLanjut } from "@/lib/tipe";

const WARNA_SKOR = { Rendah: "text-emerald-700", Sedang: "text-amber-700", Tinggi: "text-rose-700" };

export function DetailSiswa() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [siswa, setSiswa] = useState<SiswaData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<SiswaData>(`/api/siswa/${id}`).then(setSiswa).catch((e) => setError(e.message));
  }, [id]);

  async function hapus() {
    if (!siswa || !confirm(`Hapus data ${siswa.nama} beserta riwayat tindak lanjutnya?`)) return;
    try {
      await api(`/api/siswa/${id}`, { method: "DELETE" });
      router.push("/siswa");
    } catch (e) {
      alert(e instanceof ApiError ? e.message : "Gagal menghapus.");
    }
  }

  if (error) return <PesanError pesan={error} />;
  if (!siswa) return <Memuat />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/siswa" className="text-sm text-teal-800 hover:underline">← Data siswa</Link>
          <h1 className="mt-1 text-2xl font-semibold">{siswa.nama}</h1>
          <p className="text-sm text-slate-600">Kelas {siswa.kelas} · {siswa.kabupaten}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/siswa/${id}/edit`} className="tombol-sekunder">Ubah data</Link>
          <button onClick={hapus} className="tombol-bahaya">Hapus</button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="kartu">
          <h2 className="text-sm font-medium text-slate-600">Skor risiko putus sekolah</h2>
          <div className="mt-2 flex items-end gap-3">
            <span className={`text-5xl font-semibold tabular-nums ${WARNA_SKOR[siswa.kategori]}`}>{Math.round(siswa.skor_risiko)}</span>
            <span className="mb-2 text-sm text-slate-500">/ 100</span>
            <span className="mb-2 ml-auto"><BadgeKategori kategori={siswa.kategori} /></span>
          </div>
          <h3 className="mt-5 text-sm font-medium text-slate-600">Faktor penyebab utama</h3>
          {siswa.faktor.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">Tidak ada faktor yang menonjol menaikkan risiko.</p>
          ) : (
            <ol className="mt-2 space-y-2">
              {siswa.faktor.map((f, i) => (
                <li key={f.fitur} className="flex gap-2 text-sm">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-semibold">{i + 1}</span>
                  {f.penjelasan}
                </li>
              ))}
            </ol>
          )}
          <p className="mt-4 text-xs text-slate-500">
            Dihitung model Logistic Regression; faktor diurutkan dari nilai SHAP terbesar.
          </p>
        </section>

        <section className="kartu lg:col-span-2">
          <h2 className="mb-3 font-semibold">Data siswa</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            {[
              ["Kehadiran", `${siswa.kehadiran_persen}%`],
              ["Rata-rata nilai", `${siswa.rata_nilai} (${siswa.tren_nilai})`],
              ["Pelanggaran", siswa.jumlah_pelanggaran],
              ["Jarak / waktu", `${siswa.jarak_km} km / ${siswa.waktu_tempuh_menit} mnt`],
              ["Bantuan", siswa.penerima_bantuan],
              ["Pekerjaan ortu", siswa.pekerjaan_ortu],
              ["Tinggal bersama", siswa.status_tinggal],
              ["Ikut bekerja", siswa.ikut_bekerja],
              ["Saudara", siswa.jumlah_saudara],
              ["Perundungan", siswa.laporan_perundungan],
            ].map(([k, v]) => (
              <div key={k as string}>
                <dt className="text-slate-500">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          {siswa.catatan_bk && (
            <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm">
              <p className="mb-1 text-slate-500">Catatan guru BK</p>
              <p>{siswa.catatan_bk}</p>
            </div>
          )}
        </section>
      </div>

      <Rekomendasi siswaId={id} awal={siswa.rekomendasi ?? null} />
      <RiwayatTindakLanjut siswaId={id} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rekomendasi AI
// ---------------------------------------------------------------------------
function Rekomendasi({ siswaId, awal }: { siswaId: string; awal: HasilRekomendasi | null }) {
  const [rek, setRek] = useState<HasilRekomendasi | null>(awal);
  const [proses, setProses] = useState(false);
  const [error, setError] = useState("");
  const [tersalin, setTersalin] = useState(false);

  async function buat() {
    setProses(true);
    setError("");
    try {
      setRek(await api<HasilRekomendasi>(`/api/siswa/${siswaId}/rekomendasi`, { method: "POST" }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal membuat rekomendasi.");
    } finally {
      setProses(false);
    }
  }

  async function salin() {
    if (!rek) return;
    await navigator.clipboard.writeText(rek.pesan_orang_tua);
    setTersalin(true);
    setTimeout(() => setTersalin(false), 2000);
  }

  return (
    <section className="kartu space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Rekomendasi intervensi (AI)</h2>
          <p className="text-xs text-slate-500">Disusun Gemini dari skor, faktor penyebab, dan catatan guru, tanpa nama siswa.</p>
        </div>
        <button onClick={buat} className="tombol" disabled={proses}>
          {proses ? "AI sedang menyusun..." : rek ? "Buat ulang" : "Buat rekomendasi"}
        </button>
      </div>

      {proses && <Memuat teks="Menghubungi AI, biasanya 5-20 detik..." />}
      {error && <PesanError pesan={error} />}

      {rek && !proses && (
        <div className="space-y-4">
          {rek.sumber === "aturan" && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {rek.peringatan ?? "Menampilkan rekomendasi cadangan berbasis aturan."}
            </div>
          )}
          <div>
            <h3 className="text-sm font-medium text-slate-600">Ringkasan kondisi</h3>
            <p className="mt-1 text-sm">{rek.ringkasan}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-slate-600">Tindakan yang disarankan</h3>
            <ol className="mt-2 space-y-2">
              {rek.rekomendasi.map((r, i) => (
                <li key={i} className="rounded-lg border border-slate-200 p-3 text-sm">
                  <p className="font-medium">{i + 1}. {r.tindakan}</p>
                  <p className="mt-0.5 text-slate-600">{r.alasan}</p>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium text-slate-600">Draf pesan WhatsApp untuk orang tua/wali</h3>
              <button onClick={salin} className="tombol-sekunder px-3 py-1 text-xs">{tersalin ? "Tersalin ✓" : "Salin"}</button>
            </div>
            <p className="mt-2 whitespace-pre-line rounded-lg bg-emerald-50 p-3 text-sm">{rek.pesan_orang_tua}</p>
          </div>
          <p className="text-xs text-slate-500">
            Sumber: {rek.sumber === "gemini" ? "Gemini (LLM)" : "aturan cadangan"}
          </p>
        </div>
      )}

      <Disclaimer />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Riwayat tindak lanjut
// ---------------------------------------------------------------------------
const LABEL_STATUS = { belum: "Belum", proses: "Proses", selesai: "Selesai" };
const WARNA_STATUS = {
  belum: "bg-slate-100 text-slate-700",
  proses: "bg-sky-50 text-sky-800",
  selesai: "bg-emerald-50 text-emerald-800",
};

function RiwayatTindakLanjut({ siswaId }: { siswaId: string }) {
  const [daftar, setDaftar] = useState<TindakLanjut[] | null>(null);
  const [baru, setBaru] = useState({ tindakan: "", catatan: "", status: "belum", tanggal: "" });
  const [error, setError] = useState("");
  const [proses, setProses] = useState(false);

  const muat = useCallback(() => {
    api<TindakLanjut[]>(`/api/siswa/${siswaId}/tindak-lanjut`).then(setDaftar).catch((e) => setError(e.message));
  }, [siswaId]);

  useEffect(muat, [muat]);

  async function tambah(e: React.FormEvent) {
    e.preventDefault();
    setProses(true);
    setError("");
    try {
      await api(`/api/siswa/${siswaId}/tindak-lanjut`, {
        method: "POST",
        json: { ...baru, tanggal: baru.tanggal || undefined },
      });
      setBaru({ tindakan: "", catatan: "", status: "belum", tanggal: "" });
      muat();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal menyimpan.");
    } finally {
      setProses(false);
    }
  }

  async function ubahStatus(tl: TindakLanjut, status: string) {
    try {
      await api(`/api/tindak-lanjut/${tl.id}`, { method: "PATCH", json: { status } });
      muat();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal mengubah status.");
    }
  }

  async function hapus(tl: TindakLanjut) {
    if (!confirm(`Hapus catatan "${tl.tindakan}"?`)) return;
    try {
      await api(`/api/tindak-lanjut/${tl.id}`, { method: "DELETE" });
      muat();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal menghapus.");
    }
  }

  return (
    <section className="kartu space-y-4">
      <div>
        <h2 className="font-semibold">Riwayat tindak lanjut</h2>
        <p className="text-xs text-slate-500">Catat tindakan yang sudah dilakukan dan perbarui statusnya.</p>
      </div>

      <form onSubmit={tambah} className="grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-6">
        <input className="input sm:col-span-2" placeholder="Tindakan, mis. Kunjungan rumah" value={baru.tindakan}
          onChange={(e) => setBaru({ ...baru, tindakan: e.target.value })} required minLength={3} maxLength={300} aria-label="Tindakan" />
        <input className="input sm:col-span-2" placeholder="Catatan (opsional)" value={baru.catatan}
          onChange={(e) => setBaru({ ...baru, catatan: e.target.value })} maxLength={2000} aria-label="Catatan" />
        <input type="date" className="input" value={baru.tanggal}
          onChange={(e) => setBaru({ ...baru, tanggal: e.target.value })} aria-label="Tanggal" />
        <select className="input" value={baru.status} onChange={(e) => setBaru({ ...baru, status: e.target.value })} aria-label="Status">
          <option value="belum">Belum</option>
          <option value="proses">Proses</option>
          <option value="selesai">Selesai</option>
        </select>
        <button className="tombol sm:col-span-6 sm:justify-self-start" disabled={proses}>
          {proses ? "Menyimpan..." : "Tambah tindakan"}
        </button>
      </form>

      {error && <PesanError pesan={error} />}
      {!daftar && !error && <Memuat />}
      {daftar?.length === 0 && <p className="text-sm text-slate-500">Belum ada tindakan yang dicatat.</p>}

      {daftar && daftar.length > 0 && (
        <ul className="divide-y divide-slate-100">
          {daftar.map((tl) => (
            <li key={tl.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="font-medium">{tl.tindakan}</p>
                <p className="text-xs text-slate-500">
                  {new Date(tl.tanggal + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                  {tl.catatan && ` · ${tl.catatan}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select value={tl.status} onChange={(e) => ubahStatus(tl, e.target.value)}
                  className={`rounded-full border-0 px-3 py-1 text-xs font-medium ${WARNA_STATUS[tl.status]}`} aria-label="Ubah status">
                  {Object.entries(LABEL_STATUS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <button onClick={() => hapus(tl)} className="text-xs text-slate-400 hover:text-rose-700" aria-label="Hapus">Hapus</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
