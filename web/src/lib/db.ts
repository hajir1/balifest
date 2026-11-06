/**
 * Koneksi database Postgres.
 *
 * - Production (Vercel): isi DATABASE_URL dengan URL Postgres (misalnya dari Neon).
 * - Lokal tanpa DATABASE_URL: memakai PGlite, yaitu Postgres yang berjalan di dalam
 *   Node.js dan menyimpan data di folder web/.data. Tidak perlu install apa-apa.
 *
 * Semua query memakai SQL biasa dengan parameter ($1, $2, ...) agar aman dari SQL injection.
 */
import seedData from "./seed-data.json";

type Row = Record<string, unknown>;
type QueryFn = <T = Row>(text: string, params?: unknown[]) => Promise<T[]>;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS siswa (
  id                  SERIAL PRIMARY KEY,
  nama                TEXT NOT NULL,
  kelas               INTEGER NOT NULL,
  kabupaten           TEXT NOT NULL,
  kehadiran_persen    REAL NOT NULL,
  rata_nilai          REAL NOT NULL,
  tren_nilai          TEXT NOT NULL,
  jarak_km            REAL NOT NULL,
  waktu_tempuh_menit  INTEGER NOT NULL,
  penerima_bantuan    TEXT NOT NULL,
  pekerjaan_ortu      TEXT NOT NULL,
  status_tinggal      TEXT NOT NULL,
  ikut_bekerja        TEXT NOT NULL,
  jumlah_saudara      INTEGER NOT NULL,
  laporan_perundungan TEXT NOT NULL,
  jumlah_pelanggaran  INTEGER NOT NULL DEFAULT 0,
  catatan_bk          TEXT NOT NULL DEFAULT '',
  -- hasil model ML (dihitung ulang setiap data siswa disimpan)
  skor_risiko         REAL NOT NULL,
  kategori            TEXT NOT NULL,
  faktor              JSONB NOT NULL DEFAULT '[]',
  -- hasil LLM terakhir (dibuat saat guru menekan tombol rekomendasi)
  rekomendasi         JSONB,
  rekomendasi_at      TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tindak_lanjut (
  id          SERIAL PRIMARY KEY,
  siswa_id    INTEGER NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  tindakan    TEXT NOT NULL,
  catatan     TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'belum' CHECK (status IN ('belum', 'proses', 'selesai')),
  tanggal     DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tindak_lanjut_siswa ON tindak_lanjut(siswa_id);
`;

async function buatKoneksi(): Promise<QueryFn> {
  const url = process.env.DATABASE_URL;

  if (url) {
    const { default: postgres } = await import("postgres");
    const sql = postgres(url, { max: 5, prepare: false });
    return async <T,>(text: string, params: unknown[] = []) =>
      (await sql.unsafe(text, params as never[])) as unknown as T[];
  }

  const { PGlite } = await import("@electric-sql/pglite");
  // Di tes atau di server tanpa disk (Vercel tanpa DATABASE_URL), data hanya di memori.
  const lokasi = process.env.PGLITE_DIR ?? (process.env.VERCEL ? undefined : ".data/pglite");
  if (lokasi && lokasi !== "memory") {
    // PGlite hanya membuat folder satu tingkat; ".data/pglite" butuh ".data" ada lebih dulu.
    const { mkdirSync } = await import("node:fs");
    mkdirSync(lokasi, { recursive: true });
  }
  const db = new PGlite(lokasi === "memory" ? undefined : lokasi);
  return async <T,>(text: string, params: unknown[] = []) => (await db.query<T>(text, params)).rows;
}

async function siapkan(): Promise<QueryFn> {
  const query = await buatKoneksi();
  for (const perintah of SCHEMA.split(";").map((s) => s.trim()).filter(Boolean)) {
    await query(perintah);
  }
  // Database baru: isi 40 siswa contoh (sintetis) supaya dashboard langsung terisi untuk juri.
  const [{ jumlah }] = await query<{ jumlah: number }>("SELECT count(*)::int AS jumlah FROM siswa");
  if (jumlah === 0 && process.env.SEED_DEMO !== "false") {
    const { simpanSiswaBaru } = await import("./siswa");
    for (const s of seedData) await simpanSiswaBaru(s as never, query);
  }
  return query;
}

// Satu koneksi dipakai bersama oleh semua request (disimpan di globalThis agar
// tidak dibuat ulang saat hot reload di mode development).
const g = globalThis as unknown as { __db?: Promise<QueryFn> };

export function getDb(): Promise<QueryFn> {
  if (!g.__db) {
    g.__db = siapkan().catch((e) => {
      g.__db = undefined; // coba lagi di request berikutnya
      throw e;
    });
  }
  return g.__db;
}

/** Jalankan satu query: `await query("SELECT * FROM siswa WHERE id = $1", [id])` */
export const query: QueryFn = async (text, params) => (await getDb())(text, params);

/** Hanya untuk tes: mulai database baru. */
export function resetDbUntukTes() {
  g.__db = undefined;
}

export type { QueryFn };
