import { getKV, setKV, json, tolakAdmin, aman } from "../../lib/cf.js";

const KEY = "hapus";
async function loadHapus(env) { const d = await getKV(env, KEY); return Array.isArray(d) ? d.map(String) : []; }

export const onRequest = aman(async ({ request, env }) => {
  if (request.method === "GET") return json(await loadHapus(env));
  if (request.method !== "POST") return json({ error: "Metode tidak didukung." }, 405);
  const tolak = await tolakAdmin(request, env); if (tolak) return tolak;
  let body = {};
  try { body = await request.json(); } catch {}
  const id = String(body.id || "").slice(0, 600);
  if (!/^[A-Za-z0-9._-]+$/.test(id)) return json({ error: "ID undangan tidak valid." }, 400);
  let list = await loadHapus(env);
  if (body.action === "hapus") { if (!list.includes(id)) list.push(id); }
  else if (body.action === "pulihkan") list = list.filter((x) => x !== id);
  else return json({ error: "Aksi tidak dikenal." }, 400);
  await setKV(env, KEY, list);
  return json({ ok: true, list });
});
