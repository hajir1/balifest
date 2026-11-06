import { wajibLogin } from "@/lib/auth";
import { bacaJson, errorServer, parseId, tidakDitemukan } from "@/lib/http";
import { hapusTindakLanjut, ubahTindakLanjut } from "@/lib/siswa";
import { UbahTindakLanjutSchema } from "@/lib/tindak-lanjut";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/tindak-lanjut/5: ubah status/isi tindakan. */
export async function PATCH(req: Request, { params }: Ctx) {
  const belum = await wajibLogin();
  if (belum) return belum;
  const id = parseId((await params).id);
  if (!id) return tidakDitemukan("Tindak lanjut");
  const input = await bacaJson(req, UbahTindakLanjutSchema);
  if ("error" in input) return input.error;
  try {
    const row = await ubahTindakLanjut(id, input.data);
    return row ? Response.json(row) : tidakDitemukan("Tindak lanjut");
  } catch (e) {
    return errorServer("Ubah tindak lanjut gagal:", e);
  }
}

/** DELETE /api/tindak-lanjut/5 */
export async function DELETE(_req: Request, { params }: Ctx) {
  const belum = await wajibLogin();
  if (belum) return belum;
  const id = parseId((await params).id);
  if (!id) return tidakDitemukan("Tindak lanjut");
  try {
    return (await hapusTindakLanjut(id)) ? Response.json({ ok: true }) : tidakDitemukan("Tindak lanjut");
  } catch (e) {
    return errorServer("Hapus tindak lanjut gagal:", e);
  }
}
