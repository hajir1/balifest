import { Suspense } from "react";
import { Navigasi } from "@/components/navigasi";

/** Tata letak halaman setelah login: navigasi di atas, isi di tengah. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      {/* Navigasi membaca URL aktif, jadi dibungkus Suspense */}
      <Suspense fallback={<div className="h-14 border-b border-slate-200 bg-white" />}>
        <Navigasi />
      </Suspense>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">{children}</main>
      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        SiagaSekolah · Data siswa di aplikasi demo ini adalah data sintetis.
      </footer>
    </div>
  );
}
