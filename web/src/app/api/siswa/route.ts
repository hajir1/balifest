import type { NextRequest } from "next/server";
import { wajibLogin } from "@/lib/auth";
import { errorServer } from "@/lib/http";
import { bacaSiswa } from "@/lib/schemas";
import { daftarSiswa, simpanSiswaBaru, type FilterSiswa } from "@/lib/siswa";

/** GET /api/siswa?kelas=10&kategori=Tinggi&cari=wayan&urut=skor_desc */
export async function GET(req: NextRequest) {
  const belum = await wajibLogin();
  if (belum) return belum;

  const q = req.nextUrl.searchParams;
  const urut = q.get("urut") as FilterSiswa["urut"];
  try {
    const siswa = await daftarSiswa({
      kelas: Number(q.get("kelas")) || undefined,
      kategori: ["Rendah", "Sedang", "Tinggi"].includes(q.get("kategori") ?? "") ? q.get("kategori")! : undefined,
      cari: q.get("cari")?.slice(0, 60) || undefined,
      urut: urut ?? undefined,
    });
    // Daftar tidak perlu isi rekomendasi lengkap (lebih ringan)
    return Response.json(siswa.map(({ rekomendasi, ...s }) => ({ ...s, ada_rekomendasi: rekomendasi !== null })));
  } catch (e) {
    return errorServer("Daftar siswa gagal:", e);
  }
}

/** POST /api/siswa: tambah siswa; skor risiko langsung dihitung model ML. */
export async function POST(req: Request) {
  const belum = await wajibLogin();
  if (belum) return belum;

  const input = await bacaSiswa(req);
  if ("error" in input) return input.error;
  try {
    return Response.json(await simpanSiswaBaru(input.data), { status: 201 });
  } catch (e) {
    return errorServer("Tambah siswa gagal:", e);
  }
}
