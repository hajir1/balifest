/**
 * Fungsi bantu untuk memanggil API dari halaman (browser).
 * Jika sesi habis (401), pengguna diarahkan ke halaman login.
 */
export class ApiError extends Error {
  constructor(message: string, public status: number, public detail?: Record<string, string[]>) {
    super(message);
  }
}

export async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: json !== undefined ? { "content-type": "application/json", ...rest.headers } : rest.headers,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiError("Tidak dapat terhubung ke server. Periksa koneksi internet.", 0);
  }

  if (res.status === 401 && !url.startsWith("/api/auth/")) {
    // Di luar komponen React, jadi pakai window.location (bukan useRouter)
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
    throw new ApiError("Sesi habis, silakan login lagi.", 401);
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(data?.error ?? `Terjadi kesalahan (${res.status}).`, res.status, data?.detail);
  return data as T;
}
