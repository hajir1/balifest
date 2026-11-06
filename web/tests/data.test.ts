import { beforeAll, describe, expect, it, vi } from "vitest";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { GET as dashboard } from "@/app/api/dashboard/route";
import { DELETE as hapusSiswa, GET as detailSiswa, PUT as ubahSiswa } from "@/app/api/siswa/[id]/route";
import { POST as rekomendasi } from "@/app/api/siswa/[id]/rekomendasi/route";
import { GET as daftarTL, POST as tambahTL } from "@/app/api/siswa/[id]/tindak-lanjut/route";
import { POST as importCsv } from "@/app/api/siswa/import/route";
import { GET as daftarSiswa, POST as tambahSiswa } from "@/app/api/siswa/route";
import { GET as template } from "@/app/api/siswa/template/route";
import { DELETE as hapusTL, PATCH as ubahTL } from "@/app/api/tindak-lanjut/[id]/route";
import { parseCsv, TEMPLATE_CSV } from "@/lib/csv";
import { NextRequest } from "next/server";
import { post, SISWA_AMAN, SISWA_RAWAN } from "./contoh";
import { cookieJar } from "./setup";

const ctx = (id: number | string) => ({ params: Promise.resolve({ id: String(id) }) });
const get = (url: string) => new NextRequest(`http://localhost${url}`);
const json = (method: string, body: unknown) =>
  new Request("http://localhost/x", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

async function masuk() {
  const r = await login(post("/api/auth/login", { username: "guru", password: "rahasia123" }));
  expect(r.status).toBe(200);
}

beforeAll(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("login", () => {
  it("password salah ditolak", async () => {
    cookieJar.clear();
    const r = await login(post("/api/auth/login", { username: "guru", password: "salah" }));
    expect(r.status).toBe(401);
    expect(cookieJar.size).toBe(0);
  });

  it("API ditolak sebelum login", async () => {
    cookieJar.clear();
    expect((await daftarSiswa(get("/api/siswa"))).status).toBe(401);
    expect((await tambahSiswa(post("/api/siswa", SISWA_RAWAN))).status).toBe(401);
  });

  it("login berhasil menyimpan cookie, logout menghapusnya", async () => {
    await masuk();
    expect(cookieJar.size).toBe(1);
    await logout();
    expect(cookieJar.size).toBe(0);
  });

  it("cookie palsu ditolak", async () => {
    cookieJar.set("siaga_sesi", "token.palsu.sekali");
    expect((await daftarSiswa(get("/api/siswa"))).status).toBe(401);
  });
});

describe("CRUD siswa + tindak lanjut", () => {
  let idRawan = 0;

  it("tambah siswa menghitung skor risiko", async () => {
    await masuk();
    const r = await tambahSiswa(post("/api/siswa", SISWA_RAWAN));
    expect(r.status).toBe(201);
    const s = await r.json();
    idRawan = s.id;
    expect(s.kategori).toBe("Tinggi");
    expect(s.faktor.length).toBeGreaterThan(0);
    await tambahSiswa(post("/api/siswa", SISWA_AMAN));
  });

  it("input tidak valid ditolak 422", async () => {
    const r = await tambahSiswa(post("/api/siswa", { ...SISWA_RAWAN, kelas: 15 }));
    expect(r.status).toBe(422);
  });

  it("daftar bisa difilter dan diurutkan", async () => {
    const semua = await (await daftarSiswa(get("/api/siswa?urut=skor_desc"))).json();
    expect(semua).toHaveLength(2);
    expect(semua[0].skor_risiko).toBeGreaterThanOrEqual(semua[1].skor_risiko);
    const tinggi = await (await daftarSiswa(get("/api/siswa?kategori=Tinggi"))).json();
    expect(tinggi).toHaveLength(1);
    const kelas8 = await (await daftarSiswa(get("/api/siswa?kelas=8"))).json();
    expect(kelas8[0].nama).toBe("Made Adi");
    const cari = await (await daftarSiswa(get("/api/siswa?cari=komang"))).json();
    expect(cari).toHaveLength(1);
    // urutan tidak dikenal tidak boleh dipakai mentah di SQL
    expect((await daftarSiswa(get("/api/siswa?urut=nama;DROP TABLE siswa"))).status).toBe(200);
  });

  it("ubah siswa menghitung ulang skor", async () => {
    const r = await ubahSiswa(json("PUT", { ...SISWA_RAWAN, ...SISWA_AMAN, nama: "Komang Ayu" }), ctx(idRawan));
    const s = await r.json();
    expect(s.kategori).toBe("Rendah");
    await ubahSiswa(json("PUT", SISWA_RAWAN), ctx(idRawan)); // kembalikan
  });

  it("rekomendasi tanpa API key memakai cadangan dan tidak disimpan", async () => {
    const r = await rekomendasi(new Request("http://localhost/x", { method: "POST" }), ctx(idRawan));
    const rek = await r.json();
    expect(rek.sumber).toBe("aturan");
    expect(rek.disclaimer).toContain("alat bantu");
    const detail = await (await detailSiswa(get("/x"), ctx(idRawan))).json();
    expect(detail.rekomendasi).toBeNull();
  });

  it("tindak lanjut: tambah, ubah status, hapus", async () => {
    const r = await tambahTL(json("POST", { tindakan: "Kunjungan rumah", catatan: "Bertemu ibu" }), ctx(idRawan));
    expect(r.status).toBe(201);
    const tl = await r.json();
    expect(tl.status).toBe("belum");

    const u = await (await ubahTL(json("PATCH", { status: "selesai" }), ctx(tl.id))).json();
    expect(u.status).toBe("selesai");
    expect(u.tindakan).toBe("Kunjungan rumah");

    expect((await ubahTL(json("PATCH", { status: "batal" }), ctx(tl.id))).status).toBe(422);
    const daftar = await (await daftarTL(get("/x"), ctx(idRawan))).json();
    expect(daftar).toHaveLength(1);

    const dash = await (await dashboard(get("/api/dashboard"))).json();
    expect(dash.tindak_lanjut.selesai).toBe(1);

    expect((await hapusTL(get("/x"), ctx(tl.id))).status).toBe(200);
  });

  it("tindak lanjut untuk siswa yang tidak ada -> 404", async () => {
    expect((await tambahTL(json("POST", { tindakan: "Konseling" }), ctx(99999))).status).toBe(404);
  });

  it("dashboard menghitung kategori dan faktor", async () => {
    const d = await (await dashboard(get("/api/dashboard"))).json();
    expect(d.total).toBe(2);
    expect(d.per_kategori.Tinggi).toBe(1);
    expect(d.berisiko_tinggi[0].nama).toBe("Komang Ayu");
    expect(d.faktor_terbanyak.length).toBeGreaterThan(0);
    expect(d.kelas_tersedia).toEqual([8, 10]);
  });

  it("hapus siswa", async () => {
    expect((await hapusSiswa(get("/x"), ctx(idRawan))).status).toBe(200);
    expect((await detailSiswa(get("/x"), ctx(idRawan))).status).toBe(404);
    expect((await detailSiswa(get("/x"), ctx("abc"))).status).toBe(404);
  });
});

describe("import CSV", () => {
  it("template bisa diunduh dan diparse tanpa error", async () => {
    const r = await template();
    expect(r.headers.get("content-type")).toContain("text/csv");
    const hasil = parseCsv(TEMPLATE_CSV);
    expect(hasil.valid).toHaveLength(2);
    expect(hasil.gagal).toHaveLength(0);
  });

  it("menerima pemisah titik koma dan koma desimal", () => {
    const csv = TEMPLATE_CSV.split("\n")[0].replaceAll(",", ";") + "\nA.B.;9;Bangli;80,5;70;Stabil;3,2;15;PKH;Petani;Orang tua;Tidak;2;Tidak;0;\n";
    const hasil = parseCsv(csv);
    expect(hasil.gagal).toEqual([]);
    expect(hasil.valid[0].kehadiran_persen).toBe(80.5);
  });

  it("baris tidak valid dilaporkan dengan nomor baris", () => {
    const csv = TEMPLATE_CSV + "X.Y.,99,Jakarta,abc,70,Stabil,1,5,Tidak,Petani,Orang tua,Tidak,1,Tidak,0,\n";
    const hasil = parseCsv(csv);
    expect(hasil.valid).toHaveLength(2);
    expect(hasil.gagal[0].baris).toBe(4);
    expect(hasil.gagal[0].pesan).toContain("kelas");
  });

  it("kolom wajib hilang ditolak", () => {
    expect(parseCsv("nama,kelas\nA,10\n").error).toContain("Kolom wajib");
  });

  it("upload lewat API menyimpan siswa", async () => {
    await masuk();
    const form = new FormData();
    form.append("file", new File([TEMPLATE_CSV], "siswa.csv", { type: "text/csv" }));
    const r = await importCsv(new Request("http://localhost/x", { method: "POST", body: form }));
    expect(await r.json()).toEqual({ berhasil: 2, gagal: [] });
  });
});
