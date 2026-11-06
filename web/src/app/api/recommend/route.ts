import { predict } from "@/lib/predictor";
import { wajibLogin } from "@/lib/auth";
import { bacaSiswa } from "@/lib/schemas";
import { recommender } from "@/lib/services";

// Gemini bisa butuh beberapa detik; beri batas waktu fungsi 60 detik di Vercel.
export const maxDuration = 60;

/**
 * POST /api/recommend: prediksi risiko + rekomendasi intervensi dari Gemini.
 * Jika Gemini gagal, otomatis memakai rekomendasi cadangan berbasis aturan
 * (field "sumber" = "aturan" dan "peringatan" berisi alasannya).
 */
export async function POST(req: Request) {
  const belum = await wajibLogin();
  if (belum) return belum;

  const input = await bacaSiswa(req);
  if ("error" in input) return input.error;

  try {
    const prediksi = predict(input.data);
    const rekomendasi = await recommender.rekomendasikan(input.data, prediksi);
    return Response.json({ prediksi, rekomendasi });
  } catch (e) {
    console.error("Rekomendasi gagal:", e);
    return Response.json({ error: "Permintaan gagal diproses. Coba lagi atau hubungi admin." }, { status: 500 });
  }
}
