/**
 * Rekomendasi intervensi dengan LLM (Gemini), plus cadangan rule-based.
 *
 * Alur:
 *   1. Susun data ANONIM (tanpa nama): skor, kategori, faktor SHAP, catatan guru BK.
 *   2. Kirim ke Gemini dan minta jawaban JSON sesuai skema (structured output).
 *   3. Validasi jawaban dengan Zod. Jika valid -> tampilkan.
 *   4. Jika Gemini gagal (tidak ada API key, timeout, kuota habis, JSON rusak),
 *      pakai rekomendasi rule-based supaya aplikasi tetap bisa dipakai.
 */
import { createHash } from "node:crypto";
import type { ThinkingLevel } from "@google/genai";
import { z } from "zod";
import type { Prediksi } from "./predictor";
import type { Siswa } from "./schemas";

export const DISCLAIMER =
  "Hasil ini adalah alat bantu, bukan keputusan akhir. Keputusan tetap di tangan guru BK.";

// ---------------------------------------------------------------------------
// Bentuk jawaban yang WAJIB dipenuhi
// ---------------------------------------------------------------------------
export const RekomendasiSchema = z.object({
  ringkasan: z.string().min(20).max(800),
  rekomendasi: z
    .array(z.object({ tindakan: z.string().min(5).max(300), alasan: z.string().min(5).max(300) }))
    .min(3)
    .max(5),
  pesan_orang_tua: z.string().min(30).max(1200),
});
export type Rekomendasi = z.infer<typeof RekomendasiSchema>;

// Skema JSON yang dikirim ke Gemini (ditulis langsung agar mudah dibaca)
const SKEMA_JSON = {
  type: "object",
  properties: {
    ringkasan: { type: "string", description: "2-3 kalimat kondisi siswa" },
    rekomendasi: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: {
        type: "object",
        properties: { tindakan: { type: "string" }, alasan: { type: "string" } },
        required: ["tindakan", "alasan"],
      },
    },
    pesan_orang_tua: { type: "string", description: "Draf pesan WhatsApp untuk orang tua/wali" },
  },
  required: ["ringkasan", "rekomendasi", "pesan_orang_tua"],
};

export type HasilRekomendasi = Rekomendasi & {
  sumber: "gemini" | "aturan";
  peringatan: string | null;
  disclaimer: string;
};

// ---------------------------------------------------------------------------
// 1. Anonimisasi
// ---------------------------------------------------------------------------
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Menghapus nama siswa dan angka panjang (NISN/no. HP) dari catatan guru. */
export function anonimkanCatatan(catatan: string, nama: string): string {
  let teks = catatan ?? "";
  for (const bagian of nama.split(/[\s.]+/)) {
    if (bagian.length >= 3) {
      // inisial 1-2 huruf tidak perlu dihapus
      teks = teks.replace(new RegExp(`\\b${escapeRegex(bagian)}\\b`, "gi"), "[siswa]");
    }
  }
  teks = teks.replace(/\d{8,}/g, "[angka disamarkan]");
  return teks.trim().slice(0, 1000);
}

/** Data yang boleh dikirim ke LLM. Tidak ada nama, tidak ada NISN. */
export function susunDataAnonim(siswa: Siswa, prediksi: Prediksi) {
  return {
    id_anonim: "SISWA-" + createHash("sha256").update(siswa.nama).digest("hex").slice(0, 6).toUpperCase(),
    kelas: siswa.kelas,
    kabupaten: siswa.kabupaten,
    skor_risiko: prediksi.skor_risiko,
    kategori: prediksi.kategori,
    faktor_penyebab: prediksi.faktor_teratas.map((f) => f.penjelasan),
    penerima_bantuan: siswa.penerima_bantuan,
    status_tinggal: siswa.status_tinggal,
    catatan_guru_bk: anonimkanCatatan(siswa.catatan_bk, siswa.nama),
  };
}

// ---------------------------------------------------------------------------
// 2. Prompt untuk Gemini
// ---------------------------------------------------------------------------
export function buatPrompt(data: object): string {
  return `Kamu membantu guru BK sekolah di Bali mencegah siswa putus sekolah.
Berdasarkan data siswa (anonim) di bawah, buat dalam Bahasa Indonesia:

1. "ringkasan": 2-3 kalimat kondisi siswa, berdasarkan faktor penyebab dan catatan guru.
2. "rekomendasi": 3-5 tindakan konkret yang sesuai penyebabnya, masing-masing dengan "alasan".
   Panduan:
   - ekonomi sulit / ikut bekerja -> arahkan ke PIP/KIP, beasiswa, atau bantuan desa; atur jadwal agar kerja tidak mengganggu sekolah
   - perundungan -> konseling individu, mediasi, libatkan wali kelas
   - jarak jauh -> koordinasi transportasi, teman berangkat bersama, atau asrama
   - pernikahan dini / tekanan keluarga -> kunjungan rumah, pendekatan keluarga, libatkan tokoh adat/desa (kelian banjar)
   - kehadiran rendah -> pemantauan kehadiran mingguan dan komunikasi rutin dengan orang tua
   Hanya beri rekomendasi yang didukung data. Jangan mengarang fakta baru.
3. "pesan_orang_tua": draf pesan WhatsApp yang sopan dan hangat untuk orang tua/wali.
   Jangan menyalahkan, jangan menyebut "risiko putus sekolah" atau skor. Ajak bertemu di sekolah.
   Sapa dengan "Bapak/Ibu" dan sebut anaknya sebagai "ananda". Tanda tangan: "Guru BK".

Data siswa:
${JSON.stringify(data, null, 2)}
`;
}

// ---------------------------------------------------------------------------
// 3. Pembatas jumlah request (agar kuota API cukup selama penjurian)
// ---------------------------------------------------------------------------
export class RateLimiter {
  private waktu: number[] = [];
  constructor(private batas: number) {}

  /** Maksimal `batas` request per jam (sliding window sederhana). */
  boleh(): boolean {
    const sekarang = Date.now();
    this.waktu = this.waktu.filter((t) => sekarang - t < 3600_000);
    if (this.waktu.length >= this.batas) return false;
    this.waktu.push(sekarang);
    return true;
  }
}

/** Error yang pesannya aman ditampilkan ke guru. */
class LLMError extends Error {}

// ---------------------------------------------------------------------------
// 4. Pemanggil Gemini
// ---------------------------------------------------------------------------
export interface LLMClient {
  tersedia(): boolean;
  generate(prompt: string): Promise<string>;
}

export class GeminiClient implements LLMClient {
  private apiKey = process.env.GEMINI_API_KEY ?? "";
  private model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  private timeoutMs = Number(process.env.LLM_TIMEOUT_SECONDS || 45) * 1000;
  // Model Gemini 3 "berpikir" dulu sebelum menjawab. "low" cukup untuk tugas ini dan lebih cepat.
  private thinkingLevel = (process.env.GEMINI_THINKING_LEVEL || "low").toUpperCase();

  tersedia() {
    return this.apiKey.length > 0;
  }

  async generate(prompt: string): Promise<string> {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({
      apiKey: this.apiKey,
      httpOptions: { timeout: this.timeoutMs, retryOptions: { attempts: 1 } },
    });
    const resp = await ai.models.generateContent({
      model: this.model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: SKEMA_JSON, // structured output
        temperature: 0.4,
        thinkingConfig: { thinkingLevel: this.thinkingLevel as ThinkingLevel },
      },
    });
    return resp.text ?? "";
  }
}

// ---------------------------------------------------------------------------
// 5. Cadangan rule-based
// ---------------------------------------------------------------------------
const ATURAN: Record<string, [string, string]> = {
  kehadiran_persen: [
    "Pantau kehadiran setiap minggu dan hubungi orang tua bila absen 2 hari berturut-turut.",
    "Kehadiran rendah adalah tanda awal paling kuat sebelum siswa berhenti sekolah.",
  ],
  ikut_bekerja: [
    "Bicarakan dengan siswa dan orang tua agar jam kerja tidak bentrok dengan jam sekolah; cek kelayakan PIP/KIP.",
    "Siswa ikut bekerja menandakan tekanan ekonomi keluarga.",
  ],
  penerima_bantuan: [
    "Periksa status PIP/KIP siswa dan bantu proses pengajuan beasiswa atau bantuan desa.",
    "Kondisi ekonomi keluarga memengaruhi kemampuan siswa tetap bersekolah.",
  ],
  pekerjaan_ortu_rentan: [
    "Periksa kelayakan siswa untuk PIP/KIP atau beasiswa daerah.",
    "Penghasilan orang tua tidak tetap sehingga biaya sekolah bisa menjadi beban.",
  ],
  laporan_perundungan: [
    "Lakukan konseling individu dan mediasi bersama wali kelas.",
    "Perundungan membuat siswa enggan datang ke sekolah.",
  ],
  waktu_tempuh_menit: [
    "Koordinasikan transportasi, misalnya teman berangkat bersama atau bantuan transport desa.",
    "Perjalanan yang lama membuat siswa mudah absen.",
  ],
  jarak_km: [
    "Koordinasikan transportasi atau pertimbangkan opsi asrama/kos yang terjangkau.",
    "Jarak rumah ke sekolah jauh.",
  ],
  tinggal_bukan_ortu: [
    "Jalin komunikasi rutin dengan kerabat/wali yang mengasuh siswa.",
    "Siswa tidak tinggal bersama orang tua sehingga pengawasan bisa berkurang.",
  ],
  rata_nilai: ["Berikan pendampingan belajar atau tutor sebaya.", "Nilai rendah dapat menurunkan motivasi bersekolah."],
  tren_turun: [
    "Ajak siswa berdiskusi tentang penyebab nilai menurun dan susun rencana belajar.",
    "Nilai yang turun sering menandakan ada masalah baru.",
  ],
  jumlah_pelanggaran: [
    "Gunakan pendekatan pembinaan, bukan hukuman, dan cari akar masalahnya.",
    "Pelanggaran berulang bisa menjadi tanda siswa kehilangan keterikatan dengan sekolah.",
  ],
  jumlah_saudara: [
    "Cek kelayakan bantuan pendidikan untuk keluarga dengan tanggungan banyak.",
    "Tanggungan keluarga besar menambah beban ekonomi.",
  ],
  jenjang_sma_smk: [
    "Diskusikan rencana masa depan siswa dan manfaat menyelesaikan SMA/SMK.",
    "Masa SMA/SMK adalah masa rawan putus sekolah.",
  ],
};

const KATA_KUNCI_CATATAN: [RegExp, string, string][] = [
  [
    /nikah|pernikahan|menikah/i,
    "Lakukan kunjungan rumah dan pendekatan keluarga, libatkan tokoh adat/desa (kelian banjar) bila perlu.",
    "Catatan guru menyebut kemungkinan pernikahan dini.",
  ],
  [/ejek|diganggu|bully|rundung|konflik/i, "Lakukan konseling individu dan mediasi bersama wali kelas.", "Catatan guru menyebut masalah dengan teman."],
];

const TINDAKAN_UMUM: [string, string][] = [
  ["Jadwalkan pertemuan dengan orang tua/wali untuk membahas kondisi siswa.", "Keterlibatan keluarga penting untuk semua kasus."],
  ["Lakukan konseling individu untuk memahami kondisi siswa secara langsung.", "Guru BK perlu mengonfirmasi faktor yang terdeteksi."],
  ["Catat perkembangan siswa dan evaluasi kembali dalam 2-4 minggu.", "Pemantauan berkala memastikan intervensi berjalan."],
];

export function rekomendasiAturan(siswa: Siswa, prediksi: Prediksi): Rekomendasi {
  const daftar: Rekomendasi["rekomendasi"] = [];
  const tambah = (tindakan: string, alasan: string) => {
    if (daftar.length < 5 && !daftar.some((t) => t.tindakan === tindakan)) daftar.push({ tindakan, alasan });
  };

  for (const f of prediksi.faktor_teratas) if (ATURAN[f.fitur]) tambah(...ATURAN[f.fitur]);
  for (const [pola, tindakan, alasan] of KATA_KUNCI_CATATAN) if (pola.test(siswa.catatan_bk)) tambah(tindakan, alasan);
  for (const [tindakan, alasan] of TINDAKAN_UMUM) if (daftar.length < 3) tambah(tindakan, alasan);

  const faktor = prediksi.faktor_teratas.map((f) => f.penjelasan.toLowerCase()).join(", ") || "tidak ada faktor menonjol";
  return {
    ringkasan:
      `Siswa kelas ${siswa.kelas} memiliki skor risiko ${Math.round(prediksi.skor_risiko)} ` +
      `(kategori ${prediksi.kategori}). Faktor yang paling berpengaruh: ${faktor}.`,
    rekomendasi: daftar,
    pesan_orang_tua:
      "Selamat pagi Bapak/Ibu. Kami dari sekolah ingin berbincang mengenai perkembangan ananda " +
      "akhir-akhir ini agar kami bisa mendukung ananda bersama-sama. Apakah Bapak/Ibu berkenan " +
      "datang ke sekolah minggu ini? Mohon kabari waktu yang sesuai. Terima kasih. Hormat kami, Guru BK.",
  };
}

// ---------------------------------------------------------------------------
// 6. Fungsi utama yang dipanggil /api/recommend
// ---------------------------------------------------------------------------
export class Recommender {
  private limiter = new RateLimiter(Number(process.env.LLM_MAX_REQUESTS_PER_HOUR || 60));
  private cache = new Map<string, HasilRekomendasi>(); // data sama -> jawaban sama, hemat kuota

  constructor(public llm: LLMClient = new GeminiClient()) {}

  async rekomendasikan(siswa: Siswa, prediksi: Prediksi): Promise<HasilRekomendasi> {
    const data = susunDataAnonim(siswa, prediksi);
    const kunci = createHash("sha256").update(JSON.stringify(data)).digest("hex");
    const tersimpan = this.cache.get(kunci);
    if (tersimpan) return tersimpan;

    try {
      const rek = await this.panggilLLM(data);
      const hasil: HasilRekomendasi = { sumber: "gemini", peringatan: null, ...rek, disclaimer: DISCLAIMER };
      this.cache.set(kunci, hasil);
      return hasil;
    } catch (e) {
      const pesan = e instanceof LLMError ? e.message : "Terjadi kesalahan pada layanan AI.";
      return { sumber: "aturan", peringatan: pesan, ...rekomendasiAturan(siswa, prediksi), disclaimer: DISCLAIMER };
    }
  }

  private async panggilLLM(data: object): Promise<Rekomendasi> {
    const cadangan = " Menampilkan rekomendasi cadangan berbasis aturan.";
    if (!this.llm.tersedia()) throw new LLMError("Layanan AI belum dikonfigurasi." + cadangan);
    if (!this.limiter.boleh()) throw new LLMError("Batas penggunaan AI per jam tercapai." + cadangan);

    let teks: string;
    try {
      teks = await this.llm.generate(buatPrompt(data));
    } catch (e) {
      // timeout, jaringan, kuota habis, API key salah, dll. Detailnya hanya di log server.
      console.warn("Gemini gagal:", e instanceof Error ? e.message : e);
      throw new LLMError("Layanan AI sedang tidak dapat dihubungi." + cadangan);
    }

    try {
      return RekomendasiSchema.parse(JSON.parse(teks));
    } catch (e) {
      console.warn("Jawaban Gemini tidak valid:", e instanceof Error ? e.message : e);
      throw new LLMError("Jawaban AI tidak sesuai format." + cadangan);
    }
  }
}
