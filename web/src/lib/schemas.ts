/**
 * Validasi input dengan Zod. Data yang tidak sesuai (field hilang, salah tipe,
 * di luar rentang) ditolak dengan status 422 dan pesan per field.
 */
import { z } from "zod";

export const KABUPATEN = [
  "Badung", "Bangli", "Buleleng", "Denpasar", "Gianyar",
  "Jembrana", "Karangasem", "Klungkung", "Tabanan",
] as const;

const YaTidak = z.enum(["Ya", "Tidak"]);

export const SiswaSchema = z.object({
  nama: z.string().trim().min(1).max(60),
  kelas: z.number().int().min(7).max(12),
  kabupaten: z.enum(KABUPATEN),
  kehadiran_persen: z.number().min(0).max(100),
  rata_nilai: z.number().min(0).max(100),
  tren_nilai: z.enum(["Naik", "Turun", "Stabil"]),
  jarak_km: z.number().min(0).max(100),
  waktu_tempuh_menit: z.number().int().min(0).max(300),
  penerima_bantuan: z.enum(["KIP", "PKH", "Tidak"]),
  pekerjaan_ortu: z.string().trim().min(1).max(60),
  status_tinggal: z.enum(["Orang tua", "Kerabat", "Sendiri"]),
  ikut_bekerja: YaTidak,
  jumlah_saudara: z.number().int().min(0).max(20),
  laporan_perundungan: YaTidak,
  jumlah_pelanggaran: z.number().int().min(0).max(100).default(0),
  catatan_bk: z.string().max(2000).default(""),
});

export type Siswa = z.infer<typeof SiswaSchema>;

/** Membaca body JSON dan memvalidasinya. Mengembalikan data atau Response error. */
export async function bacaSiswa(req: Request): Promise<{ data: Siswa } | { error: Response }> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { error: Response.json({ error: "Body harus berupa JSON yang valid." }, { status: 400 }) };
  }
  const hasil = SiswaSchema.safeParse(body);
  if (!hasil.success) {
    return {
      error: Response.json(
        { error: "Data siswa tidak valid.", detail: z.flattenError(hasil.error).fieldErrors },
        { status: 422 },
      ),
    };
  }
  return { data: hasil.data };
}
