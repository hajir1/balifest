import { cookies } from "next/headers";
import { z } from "zod";
import { buatToken, cekKredensial, NAMA_COOKIE, opsiCookie } from "@/lib/auth";
import { bacaJson, errorServer } from "@/lib/http";

const LoginSchema = z.object({ username: z.string().min(1).max(100), password: z.string().min(1).max(200) });

/** POST /api/auth/login: cek username/password, lalu simpan token sesi di cookie. */
export async function POST(req: Request) {
  const input = await bacaJson(req, LoginSchema);
  if ("error" in input) return input.error;

  try {
    const hasil = cekKredensial(input.data.username, input.data.password);
    if (!hasil.ok) {
      await new Promise((r) => setTimeout(r, 500)); // memperlambat tebak-tebakan password
      return Response.json({ error: hasil.pesan }, { status: 401 });
    }
    (await cookies()).set(NAMA_COOKIE, await buatToken(input.data.username), opsiCookie);
    return Response.json({ ok: true, username: input.data.username });
  } catch (e) {
    return errorServer("Login gagal:", e);
  }
}
