// Middleware untuk semua halaman HTML website undangan.
// 1) Daftar "Peserta Sumpah Apoteker" di setiap undangan hanya berisi 84 peserta.
//    Nama undangan tambahan (TB-) tidak lagi ditambahkan ke daftar itu.
// 2) Animasi undangan tetap jalan walau Windows/HP tamu mematikan "efek animasi"
//    (prefers-reduced-motion), selama Admin > Tema & animasi = "Penuh".
//    Jika admin memilih "Ringan", pengaturan perangkat tamu tetap dihormati.

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

// Skrip yang menyisipkan nama undangan tambahan ke daftar peserta (#pl).
const TAMBAHAN_KE_PESERTA = /<script>\(function\(\)\{if\(!\/\^https\?:\$\/\.test\(location\.protocol\)\)return;fetch\('\/api\/tambahan'[\s\S]*?<\/script>/g;

export async function onRequest(ctx) {
  const res = await ctx.next();
  const ct = res.headers.get("content-type") || "";
  if (res.status !== 200 || !ct.includes("text/html")) return res;
  const path = new URL(ctx.request.url).pathname;
  if (path.startsWith("/admin")) return res;

  let html = await res.text();
  html = html.replace(TAMBAHAN_KE_PESERTA, "");
  if ((await animLevel(ctx.env)) === "penuh") {
    html = html.replace(
      /\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/g,
      "(prefers-reduced-motion: reduce) and (max-width: 0px)"
    );
  }
  const h = new Headers(res.headers);
  h.delete("content-length");
  h.delete("etag");
  return new Response(html, { status: res.status, statusText: res.statusText, headers: h });
}
