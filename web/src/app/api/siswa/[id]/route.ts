import { wajibLogin } from "@/lib/auth";
import { errorServer, parseId, tidakDitemukan } from "@/lib/http";
import { bacaSiswa } from "@/lib/schemas";
import { ambilSiswa, hapusSiswa, ubahSiswa } from "@/lib/siswa";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/siswa/12: detail siswa (termasuk rekomendasi terakhir jika ada). */
export async function GET(_req: Request, { params }: Ctx) {
  const belum = await wajibLogin();
  if (belum) return belum;
  const id = parseId((await params).id);
  if (!id) return tidakDitemukan("Siswa");
  try {
    const s = await ambilSiswa(id);
    return s ? Response.json(s) : tidakDitemukan("Siswa");
  } catch (e) {
    return errorServer("Detail siswa gagal:", e);
  }
}

/** PUT /api/siswa/12: ubah data siswa; skor dihitung ulang, rekomendasi lama dihapus. */
export async function PUT(req: Request, { params }: Ctx) {
  const belum = await wajibLogin();
  if (belum) return belum;
  const id = parseId((await params).id);
  if (!id) return tidakDitemukan("Siswa");
  const input = await bacaSiswa(req);
  if ("error" in input) return input.error;
  try {
    const s = await ubahSiswa(id, input.data);
    return s ? Response.json(s) : tidakDitemukan("Siswa");
  } catch (e) {
    return errorServer("Ubah siswa gagal:", e);
  }
}

/** DELETE /api/siswa/12: hapus siswa beserta riwayat tindak lanjutnya. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const belum = await wajibLogin();
  if (belum) return belum;
  const id = parseId((await params).id);
  if (!id) return tidakDitemukan("Siswa");
  try {
    return (await hapusSiswa(id)) ? Response.json({ ok: true }) : tidakDitemukan("Siswa");
  } catch (e) {
    return errorServer("Hapus siswa gagal:", e);
  }
}
