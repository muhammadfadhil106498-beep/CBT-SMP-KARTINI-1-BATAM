# Sistem Ujian Digital (CBT) — SMP Kartini 1 Batam

Aplikasi ujian berbasis web (*Computer-Based Test*) untuk **SMP Kartini 1 Batam** dengan **3 batasan login (Role-Based Access Control)**:

1. **Siswa**: Login menggunakan NIS, melihat daftar ujian sesuai kelas, verifikasi token ujian, mengerjakan soal (Pilihan Ganda & Esai) dengan *countdown timer*, penanda ragu-ragu, auto-save jawaban, dan melihat riwayat nilai.
2. **Guru**: Memantau progres peserta ujian secara langsung, mengelola Bank Soal & membuat paket ujian baru, mengoreksi jawaban esai, mengekspor nilai ke CSV, serta menggunakan **Asisten Penalaran Mendalam AI** (`gemini-4-carbon` dengan `ThinkingLevel.HIGH`) pada mode server Node.js.
3. **Admin**: Mengelola seluruh data pengguna (Siswa, Guru, Admin), mengatur jadwal ujian global beserta deteksi bentrok kelas/ruang, mengubah konfigurasi sistem & profil sekolah, mencadangkan/mereset data JSON, dan memantau metrik performa serta log aktivitas sistem.

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

## Akun Demo Uji Cepat

Pada halaman login tersedia tombol pengisian otomatis, atau gunakan kredensial berikut:

| Peran | Username (NIS/NIP) | Kata Sandi | Ruang Lingkup |
| :--- | :--- | :--- | :--- |
| **Siswa** (Kelas 9A) | `240901` | `123` | Mengerjakan ujian & melihat riwayat nilai |
| **Siswa** (Kelas 9B) | `240903` | `123` | Mengerjakan ujian kelas 9B |
| **Guru** (Matematika) | `guru.mtk` | `123` | Bank soal, pantau progres, kelola nilai, asisten AI |
| **Admin** (Proktor) | `admin` | `123` | Manajemen pengguna, jadwal global, sistem & log |

*Catatan: Untuk ujian yang memerlukan token (misalnya IPA Terpadu), gunakan token `IPA9B2` (atau `KRT9M1` untuk Matematika).*

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
3. Pada bagian **Build and deployment → Source**, pilih **GitHub Actions**.
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
