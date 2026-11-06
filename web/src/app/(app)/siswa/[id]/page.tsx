import { Suspense } from "react";
import { DetailSiswa } from "@/components/halaman/detail-siswa";
import { Memuat } from "@/components/ui";

// Halaman ini membaca parameter URL, jadi dibungkus Suspense agar sisa halaman bisa tampil lebih dulu.
export default function Page() {
  return (
    <Suspense fallback={<Memuat />}>
      <DetailSiswa />
    </Suspense>
  );
}
