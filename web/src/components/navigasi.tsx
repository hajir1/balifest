"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";

const MENU = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/siswa", label: "Data Siswa" },
  { href: "/siswa/baru", label: "Tambah Siswa" },
];

export function Navigasi() {
  const path = usePathname();
  const router = useRouter();
  const [buka, setBuka] = useState(false);

  async function keluar() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
  }

  const aktif = (href: string) =>
    href === "/siswa" ? path === "/siswa" || (/^\/siswa\/\d+/.test(path)) : path === href;

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-slate-900">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-700 text-sm font-bold text-white">S</span>
          SiagaSekolah
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {MENU.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className={`rounded-lg px-3 py-2 text-sm font-medium ${aktif(m.href) ? "bg-teal-50 text-teal-800" : "text-slate-600 hover:bg-slate-100"}`}
            >
              {m.label}
            </Link>
          ))}
          <button onClick={keluar} className="ml-2 rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100">
            Keluar
          </button>
        </nav>

        <button
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm md:hidden"
          onClick={() => setBuka(!buka)}
          aria-expanded={buka}
        >
          Menu
        </button>
      </div>

      {buka && (
        <nav className="border-t border-slate-200 px-4 py-2 md:hidden">
          {MENU.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              onClick={() => setBuka(false)}
              className={`block rounded-lg px-3 py-2 text-sm ${aktif(m.href) ? "bg-teal-50 font-medium text-teal-800" : "text-slate-700"}`}
            >
              {m.label}
            </Link>
          ))}
          <button onClick={keluar} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-500">
            Keluar
          </button>
        </nav>
      )}
    </header>
  );
}
