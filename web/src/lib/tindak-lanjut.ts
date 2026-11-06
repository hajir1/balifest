import { z } from "zod";

const tindakan = z.string().trim().min(3).max(300);
const catatan = z.string().max(2000);
const status = z.enum(["belum", "proses", "selesai"]);
const tanggal = z.iso.date();

export const TindakLanjutSchema = z.object({
  tindakan,
  catatan: catatan.default(""),
  status: status.default("belum"),
  tanggal: tanggal.optional(),
});

// Untuk mengubah: semua field opsional, tanpa nilai default
export const UbahTindakLanjutSchema = z.object({
  tindakan: tindakan.optional(),
  catatan: catatan.optional(),
  status: status.optional(),
  tanggal: tanggal.optional(),
});
