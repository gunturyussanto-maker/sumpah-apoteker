import { getKV, aman } from "../../lib/cf.js";

const page = (judul, isi) => `<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${judul}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#EFEAE4;color:#14233F;font-family:system-ui,sans-serif;padding:24px;text-align:center}h1{font:400 1.6rem Georgia,serif;color:#1B2F55}p{color:#59627A}</style></head><body><main><h1>${judul}</h1><p>${isi}</p></main></body></html>`;
const html = (s, status = 200) => new Response(s, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });

export const onRequest = aman(async ({ request, env, params }) => {
  const id = String(params.id || "");
  const list = (await getKV(env, "tambahan")) || [];
  const hapus = (await getKV(env, "hapus")) || [];
  if (Array.isArray(hapus) && hapus.includes(id)) return html(page("Undangan tidak berlaku", "Link undangan ini sudah tidak berlaku. Silakan hubungi panitia."), 410);
  const x = Array.isArray(list) ? list.find((e) => e.id === id) : null;
  if (!x) return html(page("Undangan tidak ditemukan", "Link ini tidak berlaku atau undangannya sudah dihapus. Silakan hubungi panitia."), 404);

  const res = await env.ASSETS.fetch(new URL("/tambahan/", request.url));
  let s = await res.text();
  const m = s.match(/(<script type="application\/json" id="baked">)([\s\S]*?)(<\/script>)/);
  if (m) {
    const bk = JSON.parse(m[2]);
    bk.to = x.nama; bk.nim = ""; bk.kin = true;
    bk.v.bcMode = "c128"; bk.v.bcText = x.kode || x.nama;
    const key = (t) => t.toLowerCase().replace(/^apt\.\s*/, "");
    const semua = String(bk.v.peserta || "").split("\n").filter(Boolean);
    const lower = new Set(semua.map((n) => n.toLowerCase()));
    for (const e of list) if (!lower.has(e.nama.toLowerCase())) semua.push(e.nama);
    semua.sort((a, b) => key(a).localeCompare(key(b)));
    bk.v.peserta = semua.join("\n");
    const baru = JSON.stringify(bk).replace(/</g, "\\u003c");
    s = s.slice(0, m.index) + m[1] + baru + m[3] + s.slice(m.index + m[0].length);
  }
  const esc = (t) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  s = s.replace(/<title>[^<]*<\/title>/, `<title>Undangan Sumpah Apoteker - ${esc(x.nama)}</title>`);
  return html(s);
});
