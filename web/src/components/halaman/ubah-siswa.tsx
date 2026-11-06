"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { FormSiswa } from "@/components/form-siswa";
import { Memuat, PesanError } from "@/components/ui";
import { api } from "@/lib/api";
import type { SiswaData } from "@/lib/tipe";

export function UbahSiswa() {
  const { id } = useParams<{ id: string }>();
  const [siswa, setSiswa] = useState<SiswaData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<SiswaData>(`/api/siswa/${id}`).then(setSiswa).catch((e) => setError(e.message));
  }, [id]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Ubah Data Siswa</h1>
      <p className="text-sm text-slate-600">Skor risiko akan dihitung ulang dan rekomendasi lama dihapus setelah disimpan.</p>
      {error && <PesanError pesan={error} />}
      {!siswa && !error && <Memuat />}
      {siswa && <FormSiswa awal={siswa} />}
    </div>
  );
}
