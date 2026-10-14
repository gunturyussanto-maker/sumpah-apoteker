// Animasi undangan tetap jalan walau Windows/HP tamu mematikan "efek animasi".
// Banyak laptop Windows & HP hemat daya mengaktifkan "prefers-reduced-motion",
// sehingga semua animasi undangan otomatis mati. Jika admin memilih tingkat animasi
// "Penuh" (Admin > Tema & animasi), file ini menonaktifkan pengecekan tersebut.
// Jika admin memilih "Ringan", pengaturan perangkat tamu tetap dihormati.
// Letakkan di: <folder website>/functions/_middleware.js

function getDb(env) {
  if (env.DB && typeof env.DB.prepare === "function") return env.DB;
  for (const v of Object.values(env)) if (v && typeof v.prepare === "function" && typeof v.batch === "function") return v;
  return null;
}

let cache = { t: 0, level: "penuh" };
async function animLevel(env) {
  if (Date.now() - cache.t < 30000) return cache.level;
  let level = "penuh";
  try {
    const db = getDb(env);
    const r = db && await db.prepare("SELECT v FROM kv WHERE k = 'pengaturan'").first();
    const p = r && JSON.parse(r.v);
    level = (p && p.tema && p.tema.anim && p.tema.anim.level) || "penuh";
  } catch (_) {}
  cache = { t: Date.now(), level };
  return level;
}

export async function onRequest(ctx) {
  const res = await ctx.next();
  const ct = res.headers.get("content-type") || "";
  if (res.status !== 200 || !ct.includes("text/html")) return res;
  if ((await animLevel(ctx.env)) !== "penuh") return res;
  const html = (await res.text()).replace(
    /\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/g,
    "(prefers-reduced-motion: reduce) and (max-width: 0px)"
  );
  const h = new Headers(res.headers);
  h.delete("content-length");
  h.delete("etag");
  return new Response(html, { status: res.status, statusText: res.statusText, headers: h });
}
