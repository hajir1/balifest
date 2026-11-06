/** Komponen tampilan kecil yang dipakai di banyak halaman. */
import type { Kategori } from "@/lib/tipe";

const WARNA: Record<Kategori, string> = {
  Rendah: "bg-emerald-50 text-emerald-800 ring-emerald-600/20",
  Sedang: "bg-amber-50 text-amber-800 ring-amber-600/20",
  Tinggi: "bg-rose-50 text-rose-800 ring-rose-600/20",
};

const WARNA_BAR: Record<Kategori, string> = {
  Rendah: "bg-emerald-500",
  Sedang: "bg-amber-500",
  Tinggi: "bg-rose-600",
};

export function BadgeKategori({ kategori }: { kategori: Kategori }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${WARNA[kategori]}`}>
      {kategori}
    </span>
  );
}

export function BarSkor({ skor, kategori }: { skor: number; kategori: Kategori }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-16 overflow-hidden rounded-full bg-slate-200 sm:w-24" aria-hidden>
        <div className={`h-full ${WARNA_BAR[kategori]}`} style={{ width: `${Math.max(2, skor)}%` }} />
      </div>
      <span className="w-9 text-right text-sm tabular-nums text-slate-700">{Math.round(skor)}</span>
    </div>
  );
}

export function PesanError({ pesan }: { pesan: string }) {
  return (
    <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
      {pesan}
    </div>
  );
}

export function Memuat({ teks = "Memuat..." }: { teks?: string }) {
  return (
    <div className="flex items-center gap-2 py-8 text-sm text-slate-500" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-teal-700" />
      {teks}
    </div>
  );
}

export const DISCLAIMER_TEKS =
  "Hasil ini adalah alat bantu, bukan keputusan akhir. Keputusan tetap di tangan guru BK.";

export function Disclaimer() {
  return (
    <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
      <strong>Perhatian:</strong> {DISCLAIMER_TEKS}
    </p>
  );
}
