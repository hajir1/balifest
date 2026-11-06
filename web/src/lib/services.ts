/**
 * Satu objek Recommender dipakai bersama oleh semua request di server yang sama,
 * supaya cache dan batas request per jam berlaku.
 * (Catatan: di Vercel, tiap instance server punya cache/batas sendiri.)
 */
import { Recommender } from "./recommender";

export const recommender = new Recommender();
