import { wajibLogin } from "@/lib/auth";
import { parseCsv } from "@/lib/csv";
import { errorServer } from "@/lib/http";
import { simpanSiswaBaru } from "@/lib/siswa";

export const maxDuration = 60;
const MAKS_UKURAN = 1024 * 1024; // 1 MB

/** POST /api/siswa/import (multipart/form-data, field "file"): import banyak siswa dari CSV. */
export async function POST(req: Request) {
  const belum = await wajibLogin();
  if (belum) return belum;

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("file");
    file = f instanceof File ? f : null;
  } catch {
    /* bukan multipart */
  }
  if (!file) return Response.json({ error: "Pilih file CSV terlebih dahulu." }, { status: 400 });
  if (file.size > MAKS_UKURAN) return Response.json({ error: "Ukuran file maksimal 1 MB." }, { status: 400 });

  const hasil = parseCsv(await file.text());
  if (hasil.error) return Response.json({ error: hasil.error }, { status: 422 });

  try {
    for (const s of hasil.valid) await simpanSiswaBaru(s);
    return Response.json({ berhasil: hasil.valid.length, gagal: hasil.gagal });
  } catch (e) {
    return errorServer("Import CSV gagal:", e);
  }
}
