/**
 * Proxy berjalan sebelum setiap halaman dibuka.
 * Jika belum login, pengguna diarahkan ke halaman /login.
 * (API routes memeriksa login sendiri lewat wajibLogin().)
 */
import { NextResponse, type NextRequest } from "next/server";
import { NAMA_COOKIE, verifikasiToken } from "@/lib/auth";

export async function proxy(req: NextRequest) {
  const user = await verifikasiToken(req.cookies.get(NAMA_COOKIE)?.value);
  const diLogin = req.nextUrl.pathname === "/login";

  if (!user && !diLogin) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  if (user && diLogin) return NextResponse.redirect(new URL("/dashboard", req.url));
  return NextResponse.next();
}

export const config = {
  // Semua halaman, kecuali API, file statis Next.js, dan file gambar/ikon
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico|csv)$).*)"],
};
