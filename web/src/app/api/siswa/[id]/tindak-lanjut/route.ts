import { wajibLogin } from "@/lib/auth";
import { bacaJson, errorServer, parseId, tidakDitemukan } from "@/lib/http";
import { daftarTindakLanjut, tambahTindakLanjut } from "@/lib/siswa";
import { TindakLanjutSchema } from "@/lib/tindak-lanjut";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/siswa/12/tindak-lanjut: riwayat tindakan untuk siswa ini. */
export async function GET(_req: Request, { params }: Ctx) {
  const belum = await wajibLogin();
  if (belum) return belum;
  const id = parseId((await params).id);
  if (!id) return tidakDitemukan("Siswa");
  try {
    return Response.json(await daftarTindakLanjut(id));
  } catch (e) {
    return errorServer("Daftar tindak lanjut gagal:", e);
  }
}

/** POST /api/siswa/12/tindak-lanjut: catat tindakan baru. */
export async function POST(req: Request, { params }: Ctx) {
  const belum = await wajibLogin();
  if (belum) return belum;
  const id = parseId((await params).id);
  if (!id) return tidakDitemukan("Siswa");
  const input = await bacaJson(req, TindakLanjutSchema);
  if ("error" in input) return input.error;
  try {
    const row = await tambahTindakLanjut(id, input.data);
    return row ? Response.json(row, { status: 201 }) : tidakDitemukan("Siswa");
  } catch (e) {
    return errorServer("Tambah tindak lanjut gagal:", e);
  }
}
