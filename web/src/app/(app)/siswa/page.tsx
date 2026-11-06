import { Suspense } from "react";
import { DaftarSiswa } from "@/components/halaman/daftar-siswa";
import { Memuat } from "@/components/ui";

// Halaman ini membaca parameter URL, jadi dibungkus Suspense agar sisa halaman bisa tampil lebih dulu.
export default function Page() {
  return (
    <Suspense fallback={<Memuat />}>
      <DaftarSiswa />
    </Suspense>
  );
}
