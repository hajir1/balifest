import { TEMPLATE_CSV } from "@/lib/csv";

/** GET /api/siswa/template: unduh template CSV untuk import. */
export async function GET() {
  return new Response(TEMPLATE_CSV, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="template-siswa.csv"',
    },
  });
}
