# Sistem Ujian Digital (CBT) — SMP Kartini 1 Batam

Aplikasi ujian berbasis web (*Computer-Based Test*) untuk **SMP Kartini 1 Batam** dengan **3 batasan login (Role-Based Access Control)**:

1. **Siswa**: Langsung masuk melalui **Portal Siswa** hanya dengan **Kode Ujian** (tanpa perlu login kata sandi), mengerjakan soal (Pilihan Ganda & Esai) dengan *countdown timer*, penanda ragu-ragu, auto-save jawaban, pengawasan anti-pindah tab (layar terkunci sementara & wajib masukkan kembali kode ujian; pelanggaran ke-3 otomatis menyelesaikan dan mengirim ujian), serta melihat riwayat nilai.
2. **Guru**: Login melalui **Portal Guru**, memantau progres peserta ujian secara langsung, mengelola Bank Soal & membuat paket ujian baru, mengoreksi jawaban esai, mengekspor nilai ke CSV, serta menggunakan **Asisten Penalaran Mendalam AI** (`gemini-4-carbon` dengan `ThinkingLevel.HIGH`) pada mode server Node.js.
3. **Admin**: Login melalui **Portal Admin**, mengelola seluruh data pengguna (tambah/edit/hapus serta **Import Massal & Templat Excel**), mengatur jadwal ujian global beserta deteksi bentrok kelas/ruang, **mengubah logo, gambar utama, dan pengumuman pada halaman index**, mengubah konfigurasi sistem, mencadangkan/mereset data JSON, dan memantau metrik performa serta log aktivitas sistem.
4. **Ganti Password**: Tersedia untuk seluruh pengguna terdaftar (Siswa, Guru, Admin) baik dari halaman index maupun dari bilah atas setelah masuk portal.

---

## Kompatibilitas GitHub (Dual-Mode Architecture)

Aplikasi ini dirancang agar **dapat langsung diuji dan di-deploy dari GitHub**:

- **Mode Statis / GitHub Pages**: Ketika di-deploy ke GitHub Pages (`npm run build` dari direktori `dist/`), aplikasi otomatis mendeteksi bahwa API server tidak tersedia dan menggunakan **penyimpanan browser (`localStorage`)** yang sudah terisi data demo SMP Kartini 1 Batam. Seluruh fitur Siswa, Guru, dan Admin tetap berjalan penuh tanpa memerlukan server database eksternal.
- **Mode Full-Stack Node.js (`server.ts`)**: Ketika dijalankan secara lokal atau di server Node.js (`npm run dev` atau `npm start`), Express menyajikan frontend sekaligus REST API (`/api/state`, `/api/reset`, `/api/health`) dengan persistensi file `data/db.json` dan endpoint AI server-side (`/api/ai/teacher-assist`).

---

## Struktur Proyek

```text
├── .github/workflows/
│   ├── ci.yml                  # Pipeline CI otomatis (lint, unit test, build)
│   └── pages.yml               # Workflow deployment otomatis ke GitHub Pages
├── src/
│   ├── assets/images/          # Aset visual lokal (logo & foto kampus)
│   ├── components/
│   │   ├── AdminPortal.tsx     # Panel Admin (Pengguna, Jadwal, Sistem & Log)
│   │   ├── ExamRunner.tsx      # Ruang CBT siswa (Timer, Navigator, Auto-save)
│   │   ├── LoginView.tsx       # Halaman masuk 3 peran & akun demo cepat
│   │   ├── StudentPortal.tsx   # Daftar ujian & riwayat nilai siswa
│   │   ├── TeacherPortal.tsx   # Progres live, Bank Soal, Nilai, Asisten AI
│   │   └── TopBar.tsx          # Bilah navigasi terpisah per peran
│   ├── data/
│   │   └── seedData.ts         # Data awal SMP Kartini 1 Batam
│   ├── services/
│   │   └── storage.ts          # Adaptor ganda API Server / LocalStorage
│   ├── types/
│   │   └── exam.ts             # Definisi tipe TypeScript domain ujian
│   ├── utils/
│   │   ├── examEngine.ts       # Logika murni (RBAC, penilaian, bentrok jadwal)
│   │   └── examEngine.test.ts  # Unit test menggunakan node:test
│   ├── App.tsx                 # Pengelola sesi & perutean berbasis peran
│   ├── index.css               # Konfigurasi Tailwind CSS v4 & tipografi
│   └── main.tsx                # Entry point React
├── server.ts                   # Server Express + Vite middleware + Gemini API
├── .env.example                # Templat variabel lingkungan
├── package.json                # Skrip build, dev, start, test, dan lint
└── vite.config.ts              # Konfigurasi Vite dengan base: './'
```

---

## Akses Demo Uji Cepat

Pada halaman index tersedia pilihan 3 portal (**Portal Siswa**, **Portal Guru**, **Portal Admin**) beserta tombol pengisian cepat:

| Peran | Cara Masuk | Kredensial / Kode Demo | Ruang Lingkup |
| :--- | :--- | :--- | :--- |
| **Siswa** | Pilih **Portal Siswa** → masukkan **Kode Ujian** (tanpa kata sandi) | Kode `KRT9M1` (Matematika) atau `IPA9B2` (IPA Terpadu) | Langsung mengerjakan ujian dengan proteksi pindah tab (maks. 3 kali) & melihat riwayat nilai |
| **Guru** (Matematika) | Pilih **Portal Guru** → username & kata sandi | `guru.mtk` / `123` | Bank soal, pantau progres live, kelola nilai, asisten AI |
| **Admin** (Proktor) | Pilih **Portal Admin** → username & kata sandi | `admin` / `123` | Pengguna + Import Excel, jadwal global, kustomisasi index, sistem & log |

---

## Setup Environment & Menjalankan Secara Lokal

### Prasyarat
- **Node.js** versi `20.x` atau `22.x` (disarankan Node 22+)
- **npm** versi `10.x`

### 1. Kloning Repositori & Instal Dependensi
```bash
git clone https://github.com/<username-anda>/<nama-repo>.git
cd <nama-repo>
npm install
```

### 2. Konfigurasi Environment (`.env`)
Salin `.env.example` menjadi `.env`:
```bash
cp .env.example .env
```
Isi variabel lingkungan sesuai kebutuhan:
- `GEMINI_API_KEY`: Opsional untuk pengujian dasar; **wajib** jika ingin mengaktifkan fitur **Asisten Soal & Analisis AI (`gemini-4-carbon`)** pada portal Guru.
- `APP_URL`: URL aplikasi saat di-host (misalnya `http://localhost:3000`).

### 3. Jalankan Mode Pengembangan (Full-Stack Port 3000)
```bash
npm run dev
```
Buka browser ke `http://localhost:3000`.

### 4. Jalankan Pengujian & Validasi Kode
```bash
# Pemeriksaan tipe TypeScript
npm run lint

# Jalankan seluruh unit test (logika RBAC, penilaian, token, bentrok jadwal)
npm test

# Build produksi
npm run build
```

---

## Deployment Langsung dari GitHub

### Opsi A: GitHub Pages (Build and deployment Source: GitHub Actions)
Repositori ini sudah dikonfigurasi penuh untuk GitHub Pages melalui `.github/workflows/pages.yml`, `.npmrc`, `vite.config.ts` (`base: './'`, `.nojekyll`, dan `404.html` fallback):
1. Push seluruh repositori ke GitHub (branch `main` atau `master`).
2. Buka **Settings → Pages** di repositori GitHub Anda.
3. Pada bagian **Build and deployment → Source**, **wajib ubah dari "Deploy from a branch" menjadi "GitHub Actions"**. *(Jika masih disetel ke "Deploy from a branch", GitHub akan menjalankan `pages build and deployment (dynamic)` dan workflow `Deploy to GitHub Pages` akan gagal pada langkah `Setup Pages`.)*
4. Workflow **Deploy to GitHub Pages** akan berjalan otomatis setiap kali ada push ke `main`/`master` (atau bisa dijalankan manual lewat tab **Actions → Deploy to GitHub Pages → Run workflow**).

### Menggunakan Custom Domain di GitHub Pages
Aplikasi mendukung **Custom Domain** (misalnya `ujian.smpkartini1batam.sch.id`) dengan path aset relatif (`base: './'`) sehingga gambar, skrip, dan routing tetap berjalan baik di subdomain maupun root domain.

1. **Atur DNS di penyedia domain Anda** (Cloudflare / Niagahoster / Rumahweb / Namecheap):
   - Jika menggunakan **subdomain** (contoh `ujian.smpkartini1batam.sch.id`):
     - Tipe: `CNAME` · Name: `ujian` · Target: `<username-github>.github.io`
   - Jika menggunakan **root/apex domain** (contoh `smpkartini1batam.sch.id`):
     - Tambahkan 4 record `A` ke IP resmi GitHub Pages: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
2. **Daftarkan domain di GitHub**:
   - Buka **Settings → Pages → Custom domain**, masukkan domain Anda (misal `ujian.smpkartini1batam.sch.id`), klik **Save**, lalu centang **Enforce HTTPS** setelah verifikasi DNS selesai.
   - *(Opsional agar CNAME selalu ikut di setiap build Actions)*: Tambahkan repository variable `CUSTOM_DOMAIN` di **Settings → Secrets and variables → Actions → Variables** (atau buat file `public/CNAME` berisi nama domain Anda).

### Opsi B: Server Node.js (VPS / Railway / Render / Cloud Run)
```bash
npm ci
npm run build
npm start
```
Server Express akan berjalan di port `3000` (atau `process.env.PORT`), menyajikan aset hasil build `dist/`, menyimpan data ke `data/db.json`, serta mengaktifkan endpoint `/api/ai/teacher-assist`.
