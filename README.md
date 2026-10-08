# Undangan Online Sumpah Apoteker

Program Studi Pendidikan Profesi Apoteker, Fakultas Farmasi ITSK RS dr. Soepraoen
27 Oktober 2026, Ballroom Hotel Atria lt. 2, Malang

Product by gunturs1farm

## Isi folder

- `index.html` : daftar buku tamu
- `undangan/` : 84 kartu undangan peserta
- `tambahan/` : template undangan tambahan (barcode TB-)
- `admin/` : panel admin (tambah, hapus, edit, tema, live YouTube, ucapan)
- `functions/` + `lib/` : server untuk **Cloudflare Pages** (database D1)
- `netlify/` : server versi lama untuk Netlify (tidak dipakai di Cloudflare)
- `aset/` : musik dan foto grup

## Hosting di Cloudflare Pages

- Production branch: `main`, build command: `exit 0`, build output directory: root (kosong atau `/`)
- Binding D1 bernama `DB` (Settings → Bindings)
- Secret `ADMIN_PASSWORD` (Settings → Variables and Secrets)

Tabel database dibuat otomatis saat pertama dipakai. Setiap commit ke `main` otomatis ter-deploy.
