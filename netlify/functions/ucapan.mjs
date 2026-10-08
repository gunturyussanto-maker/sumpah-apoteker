import { getStore } from "@netlify/blobs";
import { json, cekKataSandi } from "../lib/shared.mjs";

// Setiap ucapan disimpan sebagai blob sendiri (w/<waktu>-<acak>) agar kiriman bersamaan tidak saling menimpa.
// Blob "indeks" hanya cache untuk mempercepat pembacaan; selalu dicocokkan ulang dengan daftar blob.
const st = () => getStore({ name: "ucapan", consistency: "strong" });
const HADIR = ["hadir", "tidak", "ragu"];
const MAX = 3000;

const bersih = (s, n) => String(s || "").replace(/[\u0000-\u0008\u000B-\u001F\u007F<>]/g, "").replace(/[ \t]+/g, " ").trim().slice(0, n);

async function hash(s) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("ucapan:" + s));
  return [...new Uint8Array(d)].slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function semua() {
  const s = st();
  const { blobs } = await s.list({ prefix: "w/" });
  const keys = blobs.map((b) => b.key);
  let idx = (await s.get("indeks", { type: "json" })) || {};
  let ubah = false;
  const ada = new Set(keys);
  for (const k of Object.keys(idx)) if (!ada.has(k)) { delete idx[k]; ubah = true; }
  const kurang = keys.filter((k) => !idx[k]);
  if (kurang.length) {
    const isi = await Promise.all(kurang.map((k) => s.get(k, { type: "json" })));
    kurang.forEach((k, i) => { if (isi[i]) idx[k] = isi[i]; });
    ubah = true;
  }
  if (ubah) await s.setJSON("indeks", idx);
  return Object.entries(idx).map(([k, v]) => ({ ...v, id: k })).sort((a, b) => (b.waktu || "").localeCompare(a.waktu || ""));
}

function ringkas(list) {
  const r = { hadir: 0, tidak: 0, ragu: 0, orang: 0, total: list.length };
  for (const x of list) { if (r[x.hadir] != null) r[x.hadir]++; if (x.hadir === "hadir") r.orang += x.jumlah || 1; }
  return r;
}

const publik = (x) => ({ id: x.id, nama: x.nama, hadir: x.hadir, jumlah: x.jumlah, pesan: x.pesan, waktu: x.waktu });

export default async (req, context) => {
  if (req.method === "GET") {
    const list = await semua();
    return json({ ringkasan: ringkas(list), list: list.slice(0, 500).map(publik) });
  }
  if (req.method !== "POST") return json({ error: "Metode tidak didukung." }, 405);

  let body = {};
  try { body = await req.json(); } catch {}

  if (body.action === "kirim") {
    const nama = bersih(body.nama, 60);
    const pesan = bersih(body.pesan, 500).replace(/\n{3,}/g, "\n\n");
    const hadir = HADIR.includes(body.hadir) ? body.hadir : "";
    const jumlah = hadir === "hadir" ? Math.min(2, Math.max(1, parseInt(body.jumlah, 10) || 1)) : 0;
    const untuk = bersih(body.untuk, 120);
    if (nama.length < 2) return json({ error: "Isi nama Anda dulu." }, 400);
    if (!hadir) return json({ error: "Pilih konfirmasi kehadiran." }, 400);
    const s = st();
    const ip = await hash(context?.ip || req.headers.get("x-nf-client-connection-ip") || "anon");
    const terakhir = await s.get("ip/" + ip, { type: "json" });
    if (terakhir && Date.now() - terakhir.t < 20000) return json({ error: "Tunggu sebentar sebelum mengirim lagi." }, 429);
    const { blobs } = await s.list({ prefix: "w/" });
    if (blobs.length >= MAX) return json({ error: "Kuota ucapan sudah penuh." }, 400);
    const waktu = new Date().toISOString();
    const key = "w/" + waktu.replace(/[:.]/g, "-") + "-" + Math.random().toString(36).slice(2, 7);
    const item = { nama, hadir, jumlah, pesan, untuk, waktu, ip };
    await s.setJSON(key, item);
    await s.setJSON("ip/" + ip, { t: Date.now() });
    return json({ ok: true, item: publik({ ...item, id: key }) });
  }

  const ok = cekKataSandi(req);
  if (ok === null) return json({ error: "ADMIN_PASSWORD belum diatur di pengaturan Netlify." }, 503);
  if (!ok) { await new Promise((r) => setTimeout(r, 900)); return json({ error: "Kata sandi salah." }, 401); }

  if (body.action === "hapus") {
    const id = String(body.id || "");
    if (!/^w\/[A-Za-z0-9-]+$/.test(id)) return json({ error: "ID ucapan tidak valid." }, 400);
    await st().delete(id);
    const list = await semua();
    return json({ ok: true, ringkasan: ringkas(list), list: list.map((x) => ({ ...publik(x), untuk: x.untuk })) });
  }
  if (body.action === "edit") {
    const id = String(body.id || "");
    if (!/^w\/[A-Za-z0-9-]+$/.test(id)) return json({ error: "ID ucapan tidak valid." }, 400);
    const s = st();
    const lama = await s.get(id, { type: "json" });
    if (!lama) return json({ error: "Ucapan tidak ditemukan." }, 404);
    const nama = bersih(body.nama, 60);
    const hadir = HADIR.includes(body.hadir) ? body.hadir : lama.hadir;
    if (nama.length < 2) return json({ error: "Nama minimal 2 huruf." }, 400);
    const baru = { ...lama, nama, hadir, jumlah: hadir === "hadir" ? Math.min(2, Math.max(1, parseInt(body.jumlah, 10) || 1)) : 0,
      pesan: bersih(body.pesan, 500).replace(/\n{3,}/g, "\n\n"), diubah: new Date().toISOString() };
    await s.setJSON(id, baru);
    const idx = (await s.get("indeks", { type: "json" })) || {};
    idx[id] = baru; await s.setJSON("indeks", idx);
    const list = await semua();
    return json({ ok: true, ringkasan: ringkas(list), list: list.map((x) => ({ ...publik(x), untuk: x.untuk })) });
  }
  if (body.action === "daftar") {
    const list = await semua();
    return json({ ok: true, ringkasan: ringkas(list), list: list.map((x) => ({ ...publik(x), untuk: x.untuk })) });
  }
  return json({ error: "Aksi tidak dikenal." }, 400);
};

export const config = { path: "/api/ucapan" };
