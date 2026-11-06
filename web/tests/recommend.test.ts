import { beforeEach, describe, expect, it, vi } from "vitest";
import { predict } from "@/lib/predictor";
import { anonimkanCatatan, DISCLAIMER, Recommender, type LLMClient } from "@/lib/recommender";
import { post, SISWA_RAWAN } from "./contoh";

const JAWABAN_VALID = JSON.stringify({
  ringkasan: "Siswa sering absen dan ikut bekerja membantu keluarga sehingga nilai menurun.",
  rekomendasi: [
    { tindakan: "Cek kelayakan PIP/KIP", alasan: "Ekonomi keluarga sulit" },
    { tindakan: "Pantau kehadiran mingguan", alasan: "Kehadiran rendah" },
    { tindakan: "Kunjungan rumah", alasan: "Perlu dukungan keluarga" },
  ],
  pesan_orang_tua: "Selamat pagi Bapak/Ibu, kami ingin berbincang tentang ananda di sekolah. Hormat kami, Guru BK.",
});

/** Pengganti Gemini untuk tes. Gemini TIDAK dipanggil sungguhan. */
class LLMPalsu implements LLMClient {
  promptTerakhir = "";
  jumlahPanggilan = 0;
  constructor(private aksi: "valid" | "timeout" | "rusak" = "valid", private adaKey = true) {}
  tersedia() {
    return this.adaKey;
  }
  async generate(prompt: string) {
    this.promptTerakhir = prompt;
    this.jumlahPanggilan++;
    if (this.aksi === "timeout") throw new Error("timeout");
    if (this.aksi === "rusak") return '{"ringkasan": "terpotong';
    return JAWABAN_VALID;
  }
}

const PREDIKSI = predict(SISWA_RAWAN);

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("Recommender", () => {
  it("memakai Gemini jika jawabannya valid", async () => {
    const h = await new Recommender(new LLMPalsu("valid")).rekomendasikan(SISWA_RAWAN, PREDIKSI);
    expect(h.sumber).toBe("gemini");
    expect(h.rekomendasi).toHaveLength(3);
    expect(h.disclaimer).toBe(DISCLAIMER);
  });

  it("tanpa API key -> rule-based", async () => {
    const h = await new Recommender(new LLMPalsu("valid", false)).rekomendasikan(SISWA_RAWAN, PREDIKSI);
    expect(h.sumber).toBe("aturan");
    expect(h.peringatan).toContain("belum dikonfigurasi");
    expect(h.rekomendasi.length).toBeGreaterThanOrEqual(3);
    expect(h.rekomendasi.length).toBeLessThanOrEqual(5);
  });

  it("timeout -> rule-based", async () => {
    const h = await new Recommender(new LLMPalsu("timeout")).rekomendasikan(SISWA_RAWAN, PREDIKSI);
    expect(h.sumber).toBe("aturan");
    expect(h.peringatan).toContain("tidak dapat dihubungi");
  });

  it("JSON rusak -> rule-based", async () => {
    const h = await new Recommender(new LLMPalsu("rusak")).rekomendasikan(SISWA_RAWAN, PREDIKSI);
    expect(h.sumber).toBe("aturan");
    expect(h.peringatan).toContain("format");
  });

  it("batas request per jam", async () => {
    vi.stubEnv("LLM_MAX_REQUESTS_PER_HOUR", "1");
    const r = new Recommender(new LLMPalsu("valid"));
    expect((await r.rekomendasikan(SISWA_RAWAN, PREDIKSI)).sumber).toBe("gemini");
    const h = await r.rekomendasikan({ ...SISWA_RAWAN, nama: "B.C." }, PREDIKSI); // beda data, tidak kena cache
    expect(h.sumber).toBe("aturan");
    expect(h.peringatan).toContain("Batas");
    vi.unstubAllEnvs();
  });

  it("cache menghemat kuota", async () => {
    const llm = new LLMPalsu("valid");
    const r = new Recommender(llm);
    await r.rekomendasikan(SISWA_RAWAN, PREDIKSI);
    await r.rekomendasikan(SISWA_RAWAN, PREDIKSI);
    expect(llm.jumlahPanggilan).toBe(1);
  });

  it("nama dan NISN tidak dikirim ke LLM", async () => {
    const llm = new LLMPalsu("valid");
    const siswa = { ...SISWA_RAWAN, catatan_bk: "Komang sering absen. NISN 0081234567. Ayu bekerja di warung." };
    await new Recommender(llm).rekomendasikan(siswa, PREDIKSI);
    expect(llm.promptTerakhir).not.toContain("Komang");
    expect(llm.promptTerakhir).not.toContain("Ayu");
    expect(llm.promptTerakhir).not.toContain("0081234567");
  });

  it("anonimkanCatatan", () => {
    expect(anonimkanCatatan("Putu Gede bolos", "Putu Gede")).toBe("[siswa] [siswa] bolos");
  });

  it("rule-based membaca catatan pernikahan", async () => {
    const h = await new Recommender(new LLMPalsu("valid", false)).rekomendasikan(SISWA_RAWAN, PREDIKSI);
    expect(h.rekomendasi.some((t) => t.tindakan.includes("tokoh adat"))).toBe(true);
  });
});

describe("POST /api/recommend", () => {
  beforeEach(async () => {
    const { POST: login } = await import("@/app/api/auth/login/route");
    await login(post("/api/auth/login", { username: "guru", password: "rahasia123" }));
  });

  it("tanpa GEMINI_API_KEY tetap 200 dengan rekomendasi cadangan", async () => {
    const { POST } = await import("@/app/api/recommend/route");
    const r = await POST(post("/api/recommend", SISWA_RAWAN));
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.prediksi.kategori).toBe("Tinggi");
    expect(body.rekomendasi.sumber).toBe("aturan");
    expect(body.rekomendasi.disclaimer).toBe(DISCLAIMER);
  });

  it("422 untuk input tidak valid", async () => {
    const { POST } = await import("@/app/api/recommend/route");
    expect((await POST(post("/api/recommend", { nama: "X" }))).status).toBe(422);
  });
});
