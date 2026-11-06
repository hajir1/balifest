import type { NextRequest } from "next/server";
import { wajibLogin } from "@/lib/auth";
import { errorServer } from "@/lib/http";
import { statistikDashboard } from "@/lib/siswa";

/** GET /api/dashboard?kelas=10: ringkasan untuk halaman dashboard. */
export async function GET(req: NextRequest) {
  const belum = await wajibLogin();
  if (belum) return belum;
  try {
    return Response.json(await statistikDashboard(Number(req.nextUrl.searchParams.get("kelas")) || undefined));
  } catch (e) {
    return errorServer("Dashboard gagal:", e);
  }
}
