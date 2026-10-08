import { store, json, cekKataSandi } from "../lib/shared.mjs";

const KEY = "pengaturan";
// Kolom isi undangan yang boleh diubah admin (berlaku untuk semua kartu).
const ACARA = { event: 80, unit: 120, inst: 120, date: 16, time: 60, loc: 160, maps: 300, open1: 1200, open2: 800, rundown: 3000, tata: 3000, barnote: 300, close: 800, sign: 200, wa: 20 };

function cekYoutube(u) {
  u = String(u || "").trim();
  if (!u) return "";
  try {
    const x = new URL(u);
    if (x.protocol !== "https:") return null;
    if (!/(^|\.)youtube\.com$|(^|\.)youtu\.be$/i.test(x.hostname)) return null;
    return x.toString().slice(0, 300);
  } catch { return null; }
}
const teks = (s, n) => String(s == null ? "" : s).replace(/[\u0000-\u0008\u000B-\u001F\u007F<>]/g, "").replace(/\r/g, "").slice(0, n);

async function baca(s) {
  const p = (await s.get(KEY, { type: "json" })) || {};
  return { youtube: p.youtube || "", catatan: p.catatan || "", acara: p.acara || {}, nama: p.nama || {} };
}

export default async (req) => {
  const s = store();
  if (req.method === "GET") return json(await baca(s));
  if (req.method !== "POST") return json({ error: "Metode tidak didukung." }, 405);
  const ok = cekKataSandi(req);
  if (ok === null) return json({ error: "ADMIN_PASSWORD belum diatur di pengaturan Netlify." }, 503);
  if (!ok) { await new Promise((r) => setTimeout(r, 900)); return json({ error: "Kata sandi salah." }, 401); }
  let body = {};
  try { body = await req.json(); } catch {}
  const p = await baca(s);

  if (!body.action || body.action === "youtube") {
    const youtube = cekYoutube(body.youtube);
    if (youtube === null) return json({ error: "Link harus link YouTube (https://youtube.com/... atau https://youtu.be/...)." }, 400);
    p.youtube = youtube;
    p.catatan = teks(body.catatan, 200).replace(/\s+/g, " ").trim();
  } else if (body.action === "acara") {
    const a = {};
    for (const [k, n] of Object.entries(ACARA)) {
      if (body.acara && typeof body.acara[k] === "string") { const v = teks(body.acara[k], n).trim(); if (v) a[k] = v; }
    }
    if (a.date && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(a.date)) return json({ error: "Format tanggal tidak valid." }, 400);
    if (a.maps && !/^https:\/\//i.test(a.maps)) return json({ error: "Link Google Maps harus diawali https://" }, 400);
    if (a.wa) a.wa = a.wa.replace(/\D/g, "");
    p.acara = a;
  } else if (body.action === "nama") {
    const id = String(body.id || "");
    if (!/^[A-Za-z0-9._-]{1,600}$/.test(id)) return json({ error: "ID undangan tidak valid." }, 400);
    const nama = teks(body.nama, 120).replace(/\s+/g, " ").trim();
    if (nama) p.nama[id] = nama; else delete p.nama[id];
  } else return json({ error: "Aksi tidak dikenal." }, 400);

  await s.setJSON(KEY, p);
  return json({ ok: true, ...p });
};

export const config = { path: "/api/pengaturan" };
