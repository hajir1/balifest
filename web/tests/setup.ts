/**
 * Persiapan tes: database PGlite di memori (tanpa data contoh), akun demo palsu,
 * dan cookie palsu pengganti next/headers.
 */
import { vi } from "vitest";

process.env.PGLITE_DIR = "memory";
process.env.SEED_DEMO = "false";
process.env.DEMO_USERNAME = "guru";
process.env.DEMO_PASSWORD = "rahasia123";
process.env.GEMINI_API_KEY = "";

export const cookieJar = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (nama: string) => (cookieJar.has(nama) ? { name: nama, value: cookieJar.get(nama)! } : undefined),
    set: (nama: string, nilai: string) => void cookieJar.set(nama, nilai),
    delete: (nama: string) => void cookieJar.delete(nama),
  }),
}));
