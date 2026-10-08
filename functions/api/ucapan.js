import { db, json, tolakAdmin, aman } from "../../lib/cf.js";

// Setiap ucapan satu baris di tabel D1 "ucapan" sehingga kiriman bersamaan tidak saling menimpa.
// Nomor versi (kv "uver") naik setiap ada perubahan; daftar disimpan sementara di memori agar hemat kuota baca.
const HADIR = ["hadir", "tidak", "ragu"];
const MAX = 3000;
let CACHE = { ver: null, list: [], t: 0 };

const bersih = (s, n) => String(s || "").replace(/[\u0000-\u0008\u000B-\u001F\u007F<>]/g, "").replace(/[ \t]+/g, " ").trim().slice(0, n);

async function hash(s) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("ucapan:" + s));
  return [...new Uint8Array(d)].slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function naikVersi(d) {
  await d.prepare("INSERT INTO kv (k, v) VALUES ('uver', '1') ON CONFLICT(k) DO UPDATE SET v = CAST(CAST(v AS INTEGER) + 1 AS TEXT)").run();
  CACHE.t = 0;
}

async function semua(env) {
  const d = await db(env);
  if (Date.now() - CACHE.t < 2000 && CACHE.ver !== null) return CACHE.list;
  const r = await d.prepare("SELECT v FROM kv WHERE k = 'uver'").first();
  const ver = r ? String(r.v) : "0";
  if (ver !== CACHE.ver) {
    const { results } = await d.prepare("SELECT id, data FROM ucapan ORDER BY waktu DESC").all();
    CACHE.list = (results || []).map((x) => { try { return { ...JSON.parse(x.data), id: x.id }; } catch { return null; } }).filter(Boolean);
    CACHE.ver = ver;
  }
  CACHE.t = Date.now();
  return CACHE.list;
}

function ringkas(list) {
  const r = { hadir: 0, tidak: 0, ragu: 0, orang: 0, total: list.length };
  for (const x of list) { if (r[x.hadir] != null) r[x.hadir]++; if (x.hadir === "hadir") r.orang += x.jumlah || 1; }
  return r;
}
const publik = (x) => ({ id: x.id, nama: x.nama, hadir: x.hadir, jumlah: x.jumlah, pesan: x.pesan, waktu: x.waktu });
const lengkap = (list) => list.map((x) => ({ ...publik(x), untuk: x.untuk }));

export const onRequest = aman(async ({ request, env }) => {
  if (request.method === "GET") {
    const list = await semua(env);
    return json({ ringkasan: ringkas(list), list: list.slice(0, 500).map(publik) });
  }
  if (request.method !== "POST") return json({ error: "Metode tidak didukung." }, 405);
  let body = {};
  try { body = await request.json(); } catch {}
  const d = await db(env);

  if (body.action === "kirim") {
    const nama = bersih(body.nama, 60);
    const pesan = bersih(body.pesan, 500).replace(/\n{3,}/g, "\n\n");
    const hadir = HADIR.includes(body.hadir) ? body.hadir : "";
    const jumlah = hadir === "hadir" ? Math.min(2, Math.max(1, parseInt(body.jumlah, 10) || 1)) : 0;
    const untuk = bersih(body.untuk, 120);
    if (nama.length < 2) return json({ error: "Isi nama Anda dulu." }, 400);
    if (!hadir) return json({ error: "Pilih konfirmasi kehadiran." }, 400);
    const ip = await hash(request.headers.get("CF-Connecting-IP") || "anon");
    const now = Date.now();
    const rl = await d.prepare("SELECT t FROM rl WHERE ip = ?").bind(ip).first();
    if (rl && now - rl.t < 20000) return json({ error: "Tunggu sebentar sebelum mengirim lagi." }, 429);
    if ((await semua(env)).length >= MAX) return json({ error: "Kuota ucapan sudah penuh." }, 400);
    const waktu = new Date().toISOString();
    const id = "w/" + waktu.replace(/[:.]/g, "-") + "-" + Math.random().toString(36).slice(2, 7);
    const item = { nama, hadir, jumlah, pesan, untuk, waktu, ip };
    await d.batch([
      d.prepare("INSERT INTO ucapan (id, waktu, data) VALUES (?, ?, ?)").bind(id, waktu, JSON.stringify(item)),
      d.prepare("INSERT INTO rl (ip, t) VALUES (?, ?) ON CONFLICT(ip) DO UPDATE SET t = excluded.t").bind(ip, now),
    ]);
    await naikVersi(d);
    return json({ ok: true, item: publik({ ...item, id }) });
  }

  const tolak = await tolakAdmin(request, env); if (tolak) return tolak;

  if (body.action === "hapus") {
    const id = String(body.id || "");
    if (!/^w\/[A-Za-z0-9-]+$/.test(id)) return json({ error: "ID ucapan tidak valid." }, 400);
    await d.prepare("DELETE FROM ucapan WHERE id = ?").bind(id).run();
    await naikVersi(d);
    const list = await semua(env);
    return json({ ok: true, ringkasan: ringkas(list), list: lengkap(list) });
  }
  if (body.action === "edit") {
    const id = String(body.id || "");
    if (!/^w\/[A-Za-z0-9-]+$/.test(id)) return json({ error: "ID ucapan tidak valid." }, 400);
    const row = await d.prepare("SELECT data FROM ucapan WHERE id = ?").bind(id).first();
    if (!row) return json({ error: "Ucapan tidak ditemukan." }, 404);
    const lama = JSON.parse(row.data);
    const nama = bersih(body.nama, 60);
    const hadir = HADIR.includes(body.hadir) ? body.hadir : lama.hadir;
    if (nama.length < 2) return json({ error: "Nama minimal 2 huruf." }, 400);
    const baru = { ...lama, nama, hadir, jumlah: hadir === "hadir" ? Math.min(2, Math.max(1, parseInt(body.jumlah, 10) || 1)) : 0,
      pesan: bersih(body.pesan, 500).replace(/\n{3,}/g, "\n\n"), diubah: new Date().toISOString() };
    await d.prepare("UPDATE ucapan SET data = ? WHERE id = ?").bind(JSON.stringify(baru), id).run();
    await naikVersi(d);
    const list = await semua(env);
    return json({ ok: true, ringkasan: ringkas(list), list: lengkap(list) });
  }
  if (body.action === "daftar") {
    const list = await semua(env);
    return json({ ok: true, ringkasan: ringkas(list), list: lengkap(list) });
  }
  return json({ error: "Aksi tidak dikenal." }, 400);
});
