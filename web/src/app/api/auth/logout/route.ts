import { cookies } from "next/headers";
import { NAMA_COOKIE } from "@/lib/auth";

/** POST /api/auth/logout: hapus cookie sesi. */
export async function POST() {
  (await cookies()).delete(NAMA_COOKIE);
  return Response.json({ ok: true });
}
