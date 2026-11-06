import { beforeAll, describe, expect, it } from "vitest";
import { POST as login } from "@/app/api/auth/login/route";
import { POST } from "@/app/api/predict/route";
import { predict } from "@/lib/predictor";
import { post, SISWA_AMAN, SISWA_RAWAN } from "./contoh";

describe("predict", () => {
  it("siswa rawan berisiko Tinggi dengan faktor kehadiran/bekerja", () => {
    const p = predict(SISWA_RAWAN);
    expect(p.kategori).toBe("Tinggi");
    expect(p.faktor_teratas.length).toBeGreaterThanOrEqual(1);
    expect(p.faktor_teratas.length).toBeLessThanOrEqual(3);
    const fitur = p.faktor_teratas.map((f) => f.fitur);
    expect(fitur.includes("kehadiran_persen") || fitur.includes("ikut_bekerja")).toBe(true);
  });

  it("siswa aman berisiko Rendah", () => {
    const p = predict(SISWA_AMAN);
    expect(p.kategori).toBe("Rendah");
    expect(p.skor_risiko).toBeLessThan(25);
  });

  it("faktor diurutkan dari kontribusi terbesar", () => {
    const k = predict(SISWA_RAWAN).faktor_teratas.map((f) => f.kontribusi);
    expect([...k].sort((a, b) => b - a)).toEqual(k);
  });
});

describe("POST /api/predict", () => {
  beforeAll(async () => {
    await login(post("/api/auth/login", { username: "guru", password: "rahasia123" }));
  });

  it("200 untuk input valid", async () => {
    const r = await POST(post("/api/predict", SISWA_RAWAN));
    expect(r.status).toBe(200);
    expect((await r.json()).kategori).toBe("Tinggi");
  });

  it("422 untuk nilai di luar rentang", async () => {
    const r = await POST(post("/api/predict", { ...SISWA_RAWAN, kehadiran_persen: 150, kabupaten: "Jakarta" }));
    expect(r.status).toBe(422);
    const body = await r.json();
    expect(body.detail).toHaveProperty("kehadiran_persen");
    expect(body.detail).toHaveProperty("kabupaten");
  });

  it("422 jika field wajib hilang", async () => {
    const kurang: Record<string, unknown> = { ...SISWA_RAWAN };
    delete kurang.kelas;
    expect((await POST(post("/api/predict", kurang))).status).toBe(422);
  });

  it("400 jika body bukan JSON (misalnya Postman masih mode Text)", async () => {
    expect((await POST(post("/api/predict", "bukan json"))).status).toBe(400);
  });
});
