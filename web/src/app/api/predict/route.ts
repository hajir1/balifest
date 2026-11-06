import { predict } from "@/lib/predictor";
import { wajibLogin } from "@/lib/auth";
import { bacaSiswa } from "@/lib/schemas";

/** POST /api/predict: skor risiko (0-100), kategori, dan 3 faktor penyebab teratas (SHAP). */
export async function POST(req: Request) {
  const belum = await wajibLogin();
  if (belum) return belum;

  const input = await bacaSiswa(req);
  if ("error" in input) return input.error;

  try {
    return Response.json(predict(input.data));
  } catch (e) {
    console.error("Prediksi gagal:", e);
    return Response.json({ error: "Prediksi gagal diproses. Coba lagi atau hubungi admin." }, { status: 500 });
  }
}
