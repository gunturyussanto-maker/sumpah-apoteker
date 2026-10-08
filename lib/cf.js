// Bantuan bersama untuk Cloudflare Pages Functions (database D1 dengan binding bernama DB).
let siap = null;

export function db(env) {
  if (!env.DB) { const e = new Error("NO_DB"); e.noDb = true; throw e; }
  if (!siap) {
    siap = env.DB.batch([
      env.DB.prepare("CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL)"),
      env.DB.prepare("CREATE TABLE IF NOT EXISTS ucapan (id TEXT PRIMARY KEY, waktu TEXT NOT NULL, data TEXT NOT NULL)"),
      env.DB.prepare("CREATE TABLE IF NOT EXISTS rl (ip TEXT PRIMARY KEY, t INTEGER NOT NULL)"),
    ]).catch((e) => { siap = null; throw e; });
  }
  return siap.then(() => env.DB);
}

export async function getKV(env, k) {
  const d = await db(env);
  const r = await d.prepare("SELECT v FROM kv WHERE k = ?").bind(k).first();
  if (!r) return null;
  try { return JSON.parse(r.v); } catch { return null; }
}

export async function setKV(env, k, v) {
  const d = await db(env);
  await d.prepare("INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").bind(k, JSON.stringify(v)).run();
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

// Membungkus handler: kalau database belum disambungkan, beri pesan yang jelas.
export function aman(fn) {
  return async (ctx) => {
    try { return await fn(ctx); }
    catch (e) {
      if (e && e.noDb) return json({ error: "Database D1 belum disambungkan. Tambahkan binding D1 bernama DB di pengaturan Cloudflare Pages." }, 503);
      return json({ error: "Terjadi kesalahan server: " + String((e && e.message) || e).slice(0, 200) }, 500);
    }
  };
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

export function cekKataSandi(request, env) {
  const pw = env.ADMIN_PASSWORD;
  if (!pw) return null;
  const k = request.headers.get("x-admin-key") || "";
  if (k.length !== pw.length) return false;
  let r = 0;
  for (let i = 0; i < k.length; i++) r |= k.charCodeAt(i) ^ pw.charCodeAt(i);
  return r === 0;
}

export async function tolakAdmin(request, env) {
  const ok = cekKataSandi(request, env);
  if (ok === null) return json({ error: "ADMIN_PASSWORD belum diatur di pengaturan Cloudflare Pages." }, 503);
  if (!ok) { await new Promise((r) => setTimeout(r, 900)); return json({ error: "Kata sandi salah." }, 401); }
  return null;
}
