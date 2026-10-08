import { loadList, store } from "../lib/shared.mjs";

const page = (judul, isi) => `<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${judul}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#EFEAE4;color:#14233F;font-family:system-ui,sans-serif;padding:24px;text-align:center}h1{font:400 1.6rem Georgia,serif;color:#1B2F55}p{color:#59627A}</style></head><body><main><h1>${judul}</h1><p>${isi}</p></main></body></html>`;

export default async (req, context) => {
  const id = String(context.params?.id || "");
  const list = await loadList();
  const hapus = (await store().get("hapus", { type: "json" })) || [];
  if (Array.isArray(hapus) && hapus.includes(id)) {
    return new Response(page("Undangan tidak berlaku", "Link undangan ini sudah tidak berlaku. Silakan hubungi panitia."), {
      status: 410, headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
  const x = list.find((e) => e.id === id);
  if (!x) {
    return new Response(page("Undangan tidak ditemukan", "Link ini tidak berlaku atau undangannya sudah dihapus. Silakan hubungi panitia."), {
      status: 404, headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
  const res = await fetch(new URL("/tambahan/index.html", req.url));
  let html = await res.text();
  const m = html.match(/(<script type="application\/json" id="baked">)([\s\S]*?)(<\/script>)/);
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
    html = html.slice(0, m.index) + m[1] + baru + m[3] + html.slice(m.index + m[0].length);
  }
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  html = html.replace(/<title>[^<]*<\/title>/, `<title>Undangan Sumpah Apoteker - ${esc(x.nama)}</title>`);
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
};

export const config = { path: "/k/:id" };
