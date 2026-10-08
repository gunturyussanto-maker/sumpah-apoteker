import { store, json, cekKataSandi } from "../lib/shared.mjs";

const KEY = "hapus";

async function loadHapus() {
  const d = await store().get(KEY, { type: "json" });
  return Array.isArray(d) ? d.map(String) : [];
}

export default async (req) => {
  if (req.method === "GET") return json(await loadHapus());
  if (req.method !== "POST") return json({ error: "Metode tidak didukung." }, 405);

  const ok = cekKataSandi(req);
  if (ok === null) return json({ error: "ADMIN_PASSWORD belum diatur di pengaturan Netlify." }, 503);
  if (!ok) {
    await new Promise((r) => setTimeout(r, 900));
    return json({ error: "Kata sandi salah." }, 401);
  }

  let body = {};
  try { body = await req.json(); } catch {}
  const id = String(body.id || "").slice(0, 600);
  if (!/^[A-Za-z0-9._-]+$/.test(id)) return json({ error: "ID undangan tidak valid." }, 400);

  let list = await loadHapus();
  if (body.action === "hapus") { if (!list.includes(id)) list.push(id); }
  else if (body.action === "pulihkan") list = list.filter((x) => x !== id);
  else return json({ error: "Aksi tidak dikenal." }, 400);

  await store().setJSON(KEY, list);
  return json({ ok: true, list });
};

export const config = { path: "/api/hapus" };
