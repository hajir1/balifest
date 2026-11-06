import { wajibLogin } from "@/lib/auth";
import { errorServer, parseId, tidakDitemukan } from "@/lib/http";
import { recommender } from "@/lib/services";
import { ambilSiswa, simpanRekomendasi } from "@/lib/siswa";

export const maxDuration = 60; // Gemini bisa butuh beberapa detik

/**
 * POST /api/siswa/12/rekomendasi: minta rekomendasi intervensi dari Gemini
 * (atau cadangan rule-based), lalu simpan ke database.
 * Hanya hasil dari Gemini yang disimpan; hasil cadangan tidak, supaya bisa dicoba lagi.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const belum = await wajibLogin();
  if (belum) return belum;
  const id = parseId((await params).id);
  if (!id) return tidakDitemukan("Siswa");

  try {
    const s = await ambilSiswa(id);
    if (!s) return tidakDitemukan("Siswa");
    const prediksi = { skor_risiko: s.skor_risiko, kategori: s.kategori, faktor_teratas: s.faktor, model: "" };
    const rek = await recommender.rekomendasikan(s, prediksi);
    if (rek.sumber === "gemini") await simpanRekomendasi(id, rek);
    return Response.json(rek);
  } catch (e) {
    return errorServer("Rekomendasi gagal:", e);
  }
}
