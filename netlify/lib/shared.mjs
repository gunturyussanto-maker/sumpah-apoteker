import { getStore } from "@netlify/blobs";

export const KEY = "tambahan";
export const store = () => getStore({ name: "undangan", consistency: "strong" });

export async function loadList() {
  const data = await store().get(KEY, { type: "json" });
  return Array.isArray(data) ? data : [];
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

// Kode barcode otomatis: "TB-" (= undangan tambahan) + nama mahasiswa tanpa gelar, hanya ASCII yang aman untuk Code128.
export function kodeDariNama(nama) {
  const k = String(nama)
    .replace(/^\s*apt\.?\s*/i, "")
    .replace(/,\s*S\.?\s*Farm\.?\s*$/i, "")
    .normalize("NFKD").replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ").trim().toUpperCase();
  return "TB-" + (k || "TAMU");
}

export function cekKataSandi(req) {
  const pw = Netlify.env.get("ADMIN_PASSWORD");
  if (!pw) return null;
  const k = req.headers.get("x-admin-key") || "";
  if (k.length !== pw.length) return false;
  let r = 0;
  for (let i = 0; i < k.length; i++) r |= k.charCodeAt(i) ^ pw.charCodeAt(i);
  return r === 0;
}
