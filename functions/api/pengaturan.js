import { getKV, setKV, json, tolakAdmin, aman } from "../../lib/cf.js";

const KEY = "pengaturan";
// Nilai awal (dipindahkan dari situs Netlify) dipakai sampai admin menyimpan pengaturan baru.
const AWAL = { youtube: "https://www.youtube.com/@itsksoepraoen/streams", catatan: "07.00 WIB" };
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

async function baca(env) {
  const p = (await getKV(env, KEY)) || AWAL;
  return { youtube: p.youtube || "", catatan: p.catatan || "", acara: p.acara || {}, nama: p.nama || {}, tema: p.tema || null };
}

export const onRequest = aman(async ({ request, env }) => {
  if (request.method === "GET") return json(await baca(env));
  if (request.method !== "POST") return json({ error: "Metode tidak didukung." }, 405);
  const tolak = await tolakAdmin(request, env); if (tolak) return tolak;
  let body = {};
  try { body = await request.json(); } catch {}
  const p = await baca(env);

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
  } else if (body.action === "tema") {
    const t = body.tema;
    if (!t) { p.tema = null; }
    else {
      const warna = {};
      for (const k of ["bg", "card", "ink", "soft", "teal", "gold", "line"]) {
        const v = String((t.warna || {})[k] || "");
        if (!/^#[0-9a-fA-F]{6}$/.test(v)) return json({ error: "Warna " + k + " tidak valid." }, 400);
        warna[k] = v.toUpperCase();
      }
      const a = t.anim || {};
      const anim = {
        level: ["penuh", "ringan", "mati"].includes(a.level) ? a.level : "penuh",
        pembuka: ["geser", "pudar", "zoom"].includes(a.pembuka) ? a.pembuka : "geser",
      };
      for (const k of ["kelopak", "kilau", "bintang", "daun", "muncul"]) anim[k] = a[k] !== false;
      p.tema = { preset: teks(t.preset, 40), warna, ikutGelap: !!t.ikutGelap, anim };
    }
  } else if (body.action === "nama") {
    const id = String(body.id || "");
    if (!/^[A-Za-z0-9._-]{1,600}$/.test(id)) return json({ error: "ID undangan tidak valid." }, 400);
    const nama = teks(body.nama, 120).replace(/\s+/g, " ").trim();
    if (nama) p.nama[id] = nama; else delete p.nama[id];
  } else return json({ error: "Aksi tidak dikenal." }, 400);

  await setKV(env, KEY, p);
  return json({ ok: true, ...p });
});
