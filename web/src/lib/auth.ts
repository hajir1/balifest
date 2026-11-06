/**
 * Login sederhana untuk guru.
 *
 * - Username & password akun demo diambil dari environment variable
 *   (DEMO_USERNAME, DEMO_PASSWORD), tidak ditulis di kode.
 * - Setelah login, server membuat token JWT bertanda tangan (AUTH_SECRET)
 *   dan menyimpannya di cookie httpOnly (tidak bisa dibaca JavaScript di browser).
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";

export const NAMA_COOKIE = "siaga_sesi";
const MASA_BERLAKU_DETIK = 60 * 60 * 8; // 8 jam

function kunciRahasia(): Uint8Array {
  let secret = process.env.AUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET belum diisi.");
    secret = "rahasia-khusus-development-jangan-dipakai-di-production";
  }
  return new TextEncoder().encode(secret);
}

/** Membandingkan teks dengan waktu konstan (mencegah timing attack). */
function samaAman(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export type HasilLogin = { ok: true } | { ok: false; pesan: string };

export function cekKredensial(username: string, password: string): HasilLogin {
  const u = process.env.DEMO_USERNAME;
  const p = process.env.DEMO_PASSWORD;
  if (!u || !p) return { ok: false, pesan: "Akun belum dikonfigurasi. Isi DEMO_USERNAME dan DEMO_PASSWORD." };
  const cocok = samaAman(username, u) && samaAman(password, p);
  return cocok ? { ok: true } : { ok: false, pesan: "Username atau password salah." };
}

export async function buatToken(username: string): Promise<string> {
  return new SignJWT({ sub: username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MASA_BERLAKU_DETIK}s`)
    .sign(kunciRahasia());
}

export async function verifikasiToken(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, kunciRahasia());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null; // token rusak, kedaluwarsa, atau tanda tangan salah
  }
}

export const opsiCookie = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MASA_BERLAKU_DETIK,
};

/** Dipakai di awal setiap API route yang butuh login. Mengembalikan Response 401 jika belum login. */
export async function wajibLogin(): Promise<Response | null> {
  const token = (await cookies()).get(NAMA_COOKIE)?.value;
  const user = await verifikasiToken(token);
  if (user) return null;
  return Response.json({ error: "Silakan login terlebih dahulu." }, { status: 401 });
}
