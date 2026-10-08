import { KEY, store, loadList, json, kodeDariNama, cekKataSandi } from "../lib/shared.mjs";

const MAX = 1000;

function bersihkanNama(s) {
  return String(s || "").replace(/[\u0000-\u001F\u007F<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 120);
}

export default async (req) => {
  if (req.method === "GET") {
    const list = await loadList();
    return json(list.map(({ id, nama, kode }) => ({ id, nama, kode })));
  }
  if (req.method !== "POST") return json({ error: "Metode tidak didukung." }, 405);

  const ok = cekKataSandi(req);
  if (ok === null) return json({ error: "ADMIN_PASSWORD belum diatur di pengaturan Netlify." }, 503);
  if (!ok) {
    await new Promise((r) => setTimeout(r, 900));
    return json({ error: "Kata sandi salah." }, 401);
  }

  let body = {};
  try { body = await req.json(); } catch {}
  if (body.action === "check") return json({ ok: true });

  const list = await loadList();

  if (body.action === "add") {
    const names = (Array.isArray(body.names) ? body.names : [body.nama]).map(bersihkanNama).filter((n) => n.length >= 2);
    if (!names.length) return json({ error: "Isi minimal satu nama (2 huruf atau lebih)." }, 400);
    const ada = new Set(list.map((x) => x.nama.toLowerCase()).concat((body.existing || []).map((n) => String(n).toLowerCase())));
    const ditambah = [], dilewati = [];
    for (const nama of names) {
      if (ada.has(nama.toLowerCase())) { dilewati.push(nama); continue; }
      if (list.length >= MAX) { dilewati.push(nama); continue; }
      const id = "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      const item = { id, nama, kode: kodeDariNama(nama), dibuat: new Date().toISOString() };
      list.push(item); ada.add(nama.toLowerCase()); ditambah.push(item);
    }
    await store().setJSON(KEY, list);
    return json({ ok: true, ditambah, dilewati, list });
  }

  if (body.action === "delete") {
    const id = String(body.id || "");
    const sisa = list.filter((x) => x.id !== id);
    if (sisa.length === list.length) return json({ error: "Undangan tidak ditemukan." }, 404);
    await store().setJSON(KEY, sisa);
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
    await store().setJSON(KEY, list);
    return json({ ok: true, list });
  }

  if (body.action === "list") return json({ ok: true, list });

  return json({ error: "Aksi tidak dikenal." }, 400);
};

export const config = { path: "/api/tambahan" };
