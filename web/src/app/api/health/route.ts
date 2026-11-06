import { connection } from "next/server";
import model from "@/lib/model.json";
import { recommender } from "@/lib/services";

/** GET /api/health: cek server, model ML, dan apakah Gemini sudah dikonfigurasi. */
export async function GET() {
  await connection(); // dibaca saat request, bukan saat build (agar status API key selalu terbaru)
  return Response.json({ status: "ok", model: model.nama_model, llm_aktif: recommender.llm.tersedia() });
}
