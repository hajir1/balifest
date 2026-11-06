/**
 * Semua operasi data siswa dan tindak lanjut (dipanggil oleh API routes).
 * Setiap kali data siswa disimpan, skor risiko dihitung ulang oleh model ML.
 */
import { query as defaultQuery, type QueryFn } from "./db";
import { predict, type Faktor } from "./predictor";
import type { HasilRekomendasi } from "./recommender";
import type { Siswa } from "./schemas";

export type SiswaRow = Siswa & {
  id: number;
  skor_risiko: number;
  kategori: "Rendah" | "Sedang" | "Tinggi";
  faktor: Faktor[];
  rekomendasi: HasilRekomendasi | null;
  rekomendasi_at: string | null;
  created_at: string;
  updated_at: string;
};

export type StatusTindakLanjut = "belum" | "proses" | "selesai";
export type TindakLanjutRow = {
  id: number;
  siswa_id: number;
  tindakan: string;
  catatan: string;
  status: StatusTindakLanjut;
  tanggal: string;
  created_at: string;
  updated_at: string;
};

const KOLOM = [
  "nama", "kelas", "kabupaten", "kehadiran_persen", "rata_nilai", "tren_nilai",
  "jarak_km", "waktu_tempuh_menit", "penerima_bantuan", "pekerjaan_ortu",
  "status_tinggal", "ikut_bekerja", "jumlah_saudara", "laporan_perundungan",
  "jumlah_pelanggaran", "catatan_bk",
] as const;

// Nilai REAL dari Postgres dibulatkan agar tampil rapi (misalnya 95.6, bukan 95.59999847)
function rapikan(row: SiswaRow): SiswaRow {
  const r1 = (x: number) => Math.round(Number(x) * 10) / 10;
  return {
    ...row,
    kehadiran_persen: r1(row.kehadiran_persen),
    rata_nilai: r1(row.rata_nilai),
    jarak_km: r1(row.jarak_km),
    skor_risiko: r1(row.skor_risiko),
  };
}

// ---------------------------------------------------------------------------
// Siswa
// ---------------------------------------------------------------------------
export async function simpanSiswaBaru(s: Siswa, query: QueryFn = defaultQuery): Promise<SiswaRow> {
  const p = predict(s);
  const nilai = KOLOM.map((k) => s[k]);
  const placeholder = KOLOM.map((_, i) => `$${i + 1}`).join(", ");
  const n = KOLOM.length;
  const [row] = await query<SiswaRow>(
    `INSERT INTO siswa (${KOLOM.join(", ")}, skor_risiko, kategori, faktor)
     VALUES (${placeholder}, $${n + 1}, $${n + 2}, $${n + 3})
     RETURNING *`,
    [...nilai, p.skor_risiko, p.kategori, JSON.stringify(p.faktor_teratas)],
  );
  return rapikan(row);
}

export async function ubahSiswa(id: number, s: Siswa): Promise<SiswaRow | null> {
  const p = predict(s);
  const set = KOLOM.map((k, i) => `${k} = $${i + 1}`).join(", ");
  const n = KOLOM.length;
  // Data berubah -> rekomendasi lama tidak berlaku lagi, dikosongkan.
  const [row] = await defaultQuery<SiswaRow>(
    `UPDATE siswa SET ${set}, skor_risiko = $${n + 1}, kategori = $${n + 2}, faktor = $${n + 3},
       rekomendasi = NULL, rekomendasi_at = NULL, updated_at = now()
     WHERE id = $${n + 4} RETURNING *`,
    [...KOLOM.map((k) => s[k]), p.skor_risiko, p.kategori, JSON.stringify(p.faktor_teratas), id],
  );
  return row ? rapikan(row) : null;
}

export async function hapusSiswa(id: number): Promise<boolean> {
  const rows = await defaultQuery("DELETE FROM siswa WHERE id = $1 RETURNING id", [id]);
  return rows.length > 0;
}

export async function ambilSiswa(id: number): Promise<SiswaRow | null> {
  const [row] = await defaultQuery<SiswaRow>("SELECT * FROM siswa WHERE id = $1", [id]);
  return row ? rapikan(row) : null;
}

export async function simpanRekomendasi(id: number, rek: HasilRekomendasi): Promise<void> {
  await defaultQuery("UPDATE siswa SET rekomendasi = $1, rekomendasi_at = now() WHERE id = $2", [
    JSON.stringify(rek),
    id,
  ]);
}

export type FilterSiswa = {
  kelas?: number;
  kategori?: string;
  cari?: string;
  urut?: "skor_desc" | "skor_asc" | "nama" | "kelas" | "terbaru";
};

const URUTAN: Record<NonNullable<FilterSiswa["urut"]>, string> = {
  skor_desc: "skor_risiko DESC, nama",
  skor_asc: "skor_risiko ASC, nama",
  nama: "nama ASC",
  kelas: "kelas ASC, nama",
  terbaru: "created_at DESC",
};

export async function daftarSiswa(f: FilterSiswa = {}): Promise<SiswaRow[]> {
  const syarat: string[] = [];
  const params: unknown[] = [];
  if (f.kelas) {
    params.push(f.kelas);
    syarat.push(`kelas = $${params.length}`);
  }
  if (f.kategori) {
    params.push(f.kategori);
    syarat.push(`kategori = $${params.length}`);
  }
  if (f.cari) {
    params.push(`%${f.cari}%`);
    syarat.push(`nama ILIKE $${params.length}`);
  }
  const where = syarat.length ? `WHERE ${syarat.join(" AND ")}` : "";
  const order = URUTAN[f.urut ?? "skor_desc"] ?? URUTAN.skor_desc; // whitelist, bukan input mentah
  const rows = await defaultQuery<SiswaRow>(`SELECT * FROM siswa ${where} ORDER BY ${order} LIMIT 1000`, params);
  return rows.map(rapikan);
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
export async function statistikDashboard(kelas?: number) {
  const siswa = await daftarSiswa({ kelas, urut: "skor_desc" });

  const perKategori = { Rendah: 0, Sedang: 0, Tinggi: 0 };
  const hitungFaktor = new Map<string, { fitur: string; label: string; jumlah: number }>();

  for (const s of siswa) {
    perKategori[s.kategori]++;
    // Faktor dihitung dari siswa berisiko Sedang dan Tinggi saja
    if (s.kategori === "Rendah") continue;
    for (const f of s.faktor) {
      const lama = hitungFaktor.get(f.fitur);
      if (lama) lama.jumlah++;
      else hitungFaktor.set(f.fitur, { fitur: f.fitur, label: labelFaktor(f.fitur), jumlah: 1 });
    }
  }

  const kelasTersedia = await defaultQuery<{ kelas: number }>("SELECT DISTINCT kelas FROM siswa ORDER BY kelas");
  const [tl] = await defaultQuery<{ belum: number; proses: number; selesai: number }>(
    `SELECT count(*) FILTER (WHERE status = 'belum')::int AS belum,
            count(*) FILTER (WHERE status = 'proses')::int AS proses,
            count(*) FILTER (WHERE status = 'selesai')::int AS selesai
     FROM tindak_lanjut t JOIN siswa s ON s.id = t.siswa_id
     ${kelas ? "WHERE s.kelas = $1" : ""}`,
    kelas ? [kelas] : [],
  );

  return {
    total: siswa.length,
    per_kategori: perKategori,
    faktor_terbanyak: [...hitungFaktor.values()].sort((a, b) => b.jumlah - a.jumlah).slice(0, 8),
    berisiko_tinggi: siswa
      .filter((s) => s.kategori === "Tinggi")
      .map((s) => ({ ...s, rekomendasi: undefined })),
    kelas_tersedia: kelasTersedia.map((k) => k.kelas),
    tindak_lanjut: tl,
  };
}

/** Label pendek untuk grafik faktor (tanpa angka per siswa). */
export function labelFaktor(fitur: string): string {
  const label: Record<string, string> = {
    kehadiran_persen: "Kehadiran rendah",
    rata_nilai: "Nilai rendah",
    tren_turun: "Nilai menurun",
    waktu_tempuh_menit: "Waktu tempuh lama",
    jarak_km: "Jarak jauh",
    penerima_bantuan: "Kondisi ekonomi / bantuan",
    pekerjaan_ortu_rentan: "Pekerjaan orang tua tidak tetap",
    tinggal_bukan_ortu: "Tidak tinggal dengan orang tua",
    ikut_bekerja: "Ikut bekerja",
    jumlah_saudara: "Saudara banyak",
    laporan_perundungan: "Perundungan",
    jumlah_pelanggaran: "Pelanggaran",
    jenjang_sma_smk: "Jenjang SMA/SMK",
  };
  return label[fitur] ?? fitur;
}

// ---------------------------------------------------------------------------
// Tindak lanjut
// ---------------------------------------------------------------------------
const KOLOM_TL = "id, siswa_id, tindakan, catatan, status, to_char(tanggal, 'YYYY-MM-DD') AS tanggal, created_at, updated_at";
export async function daftarTindakLanjut(siswaId: number): Promise<TindakLanjutRow[]> {
  return defaultQuery<TindakLanjutRow>(
    `SELECT ${KOLOM_TL} FROM tindak_lanjut WHERE siswa_id = $1 ORDER BY tindak_lanjut.tanggal DESC, id DESC`,
    [siswaId],
  );
}

export async function tambahTindakLanjut(
  siswaId: number,
  data: { tindakan: string; catatan: string; status: StatusTindakLanjut; tanggal?: string },
): Promise<TindakLanjutRow | null> {
  const [row] = await defaultQuery<TindakLanjutRow>(
    `INSERT INTO tindak_lanjut (siswa_id, tindakan, catatan, status, tanggal)
     SELECT $1, $2, $3, $4, COALESCE($5::date, CURRENT_DATE) WHERE EXISTS (SELECT 1 FROM siswa WHERE id = $1)
     RETURNING ${KOLOM_TL}`,
    [siswaId, data.tindakan, data.catatan, data.status, data.tanggal ?? null],
  );
  return row ?? null;
}

export async function ubahTindakLanjut(
  id: number,
  data: Partial<{ tindakan: string; catatan: string; status: StatusTindakLanjut; tanggal: string }>,
): Promise<TindakLanjutRow | null> {
  const [row] = await defaultQuery<TindakLanjutRow>(
    `UPDATE tindak_lanjut SET
       tindakan = COALESCE($1, tindakan),
       catatan  = COALESCE($2, catatan),
       status   = COALESCE($3, status),
       tanggal  = COALESCE($4::date, tanggal),
       updated_at = now()
     WHERE id = $5 RETURNING ${KOLOM_TL}`,
    [data.tindakan ?? null, data.catatan ?? null, data.status ?? null, data.tanggal ?? null, id],
  );
  return row ?? null;
}

export async function hapusTindakLanjut(id: number): Promise<boolean> {
  const rows = await defaultQuery("DELETE FROM tindak_lanjut WHERE id = $1 RETURNING id", [id]);
  return rows.length > 0;
}
