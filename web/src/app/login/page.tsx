"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [proses, setProses] = useState(false);

  async function masuk(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setProses(true);
    try {
      await api("/api/auth/login", { method: "POST", json: { username, password } });
      const next = new URLSearchParams(window.location.search).get("next");
      // hanya izinkan path internal (mencegah redirect ke situs lain)
      window.location.href = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Login gagal.");
      setProses(false);
    }
  }

  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-teal-700 text-xl font-bold text-white">S</div>
          <h1 className="text-xl font-semibold">SiagaSekolah</h1>
          <p className="mt-1 text-sm text-slate-600">Sistem peringatan dini putus sekolah untuk guru BK</p>
        </div>

        <form onSubmit={masuk} className="kartu space-y-4">
          <div>
            <label htmlFor="username" className="label">Username</label>
            <input id="username" className="input" autoComplete="username" value={username}
              onChange={(e) => setUsername(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="password" className="label">Password</label>
            <input id="password" type="password" className="input" autoComplete="current-password" value={password}
              onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
          <button className="tombol w-full" disabled={proses}>{proses ? "Memproses..." : "Masuk"}</button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-500">
          Juri: gunakan akun demo yang tercantum di halaman pendaftaran lomba.
        </p>
      </div>
    </main>
  );
}
