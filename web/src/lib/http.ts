/** Fungsi bantu kecil untuk API routes. */
import { z } from "zod";

export async function bacaJson<T>(req: Request, schema: z.ZodType<T>): Promise<{ data: T } | { error: Response }> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { error: Response.json({ error: "Body harus berupa JSON yang valid." }, { status: 400 }) };
  }
  const hasil = schema.safeParse(body);
  if (!hasil.success) {
    return {
      error: Response.json(
        { error: "Data tidak valid.", detail: z.flattenError(hasil.error).fieldErrors },
        { status: 422 },
      ),
    };
  }
  return { data: hasil.data };
}

/** Mengubah "12" menjadi 12; selain bilangan bulat positif -> null. */
export function parseId(nilai: string): number | null {
  const n = Number(nilai);
  return Number.isInteger(n) && n > 0 && n < 2 ** 31 ? n : null;
}

export const tidakDitemukan = (apa = "Data") => Response.json({ error: `${apa} tidak ditemukan.` }, { status: 404 });

export function errorServer(konteks: string, e: unknown) {
  console.error(konteks, e);
  return Response.json({ error: "Terjadi kesalahan di server. Coba lagi beberapa saat." }, { status: 500 });
}
