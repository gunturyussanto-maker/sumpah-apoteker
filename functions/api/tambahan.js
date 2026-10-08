import { getKV, setKV, json, kodeDariNama, tolakAdmin, aman } from "../../lib/cf.js";

const KEY = "tambahan";
const MAX = 1000;
const bersihkanNama = (s) => String(s || "").replace(/[\u0000-\u001F\u007F<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 120);
async function loadList(env) { const d = await getKV(env, KEY); return Array.isArray(d) ? d : []; }

export const onRequest = aman(async ({ request, env }) => {
  if (request.method === "GET") {
    const list = await loadList(env);
    return json(list.map(({ id, nama, kode }) => ({ id, nama, kode })));
  }
  if (request.method !== "POST") return json({ error: "Metode tidak didukung." }, 405);
  const tolak = await tolakAdmin(request, env); if (tolak) return tolak;

  let body = {};
  try { body = await request.json(); } catch {}
  if (body.action === "check") return json({ ok: true });
  const list = await loadList(env);

  if (body.action === "add") {
    const names = (Array.isArray(body.names) ? body.names : [body.nama]).map(bersihkanNama).filter((n) => n.length >= 2);
    if (!names.length) return json({ error: "Isi minimal satu nama (2 huruf atau lebih)." }, 400);
    const ada = new Set(list.map((x) => x.nama.toLowerCase()).concat((body.existing || []).map((n) => String(n).toLowerCase())));
    const ditambah = [], dilewati = [];
    for (const nama of names) {
      if (ada.has(nama.toLowerCase()) || list.length >= MAX) { dilewati.push(nama); continue; }
      const id = "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      const item = { id, nama, kode: kodeDariNama(nama), dibuat: new Date().toISOString() };
      list.push(item); ada.add(nama.toLowerCase()); ditambah.push(item);
    }
    await setKV(env, KEY, list);
    return json({ ok: true, ditambah, dilewati, list });
  }
  if (body.action === "delete") {
    const id = String(body.id || "");
    const sisa = list.filter((x) => x.id !== id);
    if (sisa.length === list.length) return json({ error: "Undangan tidak ditemukan." }, 404);
    await setKV(env, KEY, sisa);
    return json({ ok: true, list: sisa });
  }
  if (body.action === "edit") {
    const id = String(body.id || "");
    const nama = bersihkanNama(body.nama);
    if (nama.length < 2) return json({ error: "Nama minimal 2 huruf." }, 400);
    const x = list.find((e) => e.id === id);
    if (!x) return json({ error: "Undangan tidak ditemukan." }, 404);
    if (list.some((e) => e.id !== id && e.nama.toLowerCase() === nama.toLowerCase())) return json({ error: "Nama itu sudah ada di daftar." }, 400);
    x.nama = nama; x.kode = kodeDariNama(nama); x.diubah = new Date().toISOString();
    await setKV(env, KEY, list);
    return json({ ok: true, list });
  }
  if (body.action === "list") return json({ ok: true, list });
  return json({ error: "Aksi tidak dikenal." }, 400);
});
