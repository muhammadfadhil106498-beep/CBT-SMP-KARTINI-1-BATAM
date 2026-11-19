import React, { useState } from 'react';
import { Eye, EyeOff, LogIn, ShieldCheck, BookOpen, UserCheck } from 'lucide-react';
import type { SystemSettings, User, UserRole } from '../types/exam';
import { authenticateUser } from '../utils/examEngine';

interface LoginViewProps {
  users: User[];
  settings: SystemSettings;
  onLoginSuccess: (user: User) => void;
}

const DEMO_ACCOUNTS: Array<{
  role: UserRole;
  label: string;
  username: string;
  password: string;
  detail: string;
}> = [
  {
    role: 'siswa',
    label: 'Siswa · Kelas 9A',
    username: '240901',
    password: '123',
    detail: 'Alya Putri Lestari',
  },
  {
    role: 'guru',
    label: 'Guru · Matematika',
    username: 'guru.mtk',
    password: '123',
    detail: 'Budi Santoso, M.Pd',
  },
  {
    role: 'admin',
    label: 'Admin · Proktor',
    username: 'admin',
    password: '123',
    detail: 'Hendra Wijaya, S.Kom',
  },
];

export const LoginView: React.FC<LoginViewProps> = ({
  users,
  settings,
  onLoginSuccess,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [campusImgFailed, setCampusImgFailed] = useState(false);
  const [crestImgFailed, setCrestImgFailed] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = authenticateUser(users, username, password);
    if (res.error || !res.user) {
      setErrorMsg(res.error ?? 'Gagal masuk ke sistem.');
      return;
    }
    setErrorMsg(null);
    onLoginSuccess(res.user);
  };

  const handleQuickFill = (demoUser: string, demoPass: string) => {
    setUsername(demoUser);
    setPassword(demoPass);
    setErrorMsg(null);
  };

  const getRoleIcon = (role: UserRole) => {
    if (role === 'siswa') return <BookOpen className="w-4 h-4 text-teal-700 shrink-0" />;
    if (role === 'guru') return <UserCheck className="w-4 h-4 text-slate-800 shrink-0" />;
    return <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 flex items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left Panel: Institutional Identity & Campus Visual */}
          <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between">
            <div className="relative h-64 sm:h-72 lg:h-80 w-full bg-slate-900 overflow-hidden">
              {!campusImgFailed ? (
                <img
                  src="./src/assets/images/smp_kartini_campus_v2_1795078091161.jpg"
                  alt="Lingkungan Kampus SMP Kartini 1 Batam"
                  referrerPolicy="no-referrer"
                  onError={() => setCampusImgFailed(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-slate-900 via-slate-800 to-teal-900 flex items-center justify-center p-6">
                  <span className="text-white/90 font-display text-lg font-semibold">
                    {settings.schoolName}
                  </span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/35 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                <p className="text-xs font-medium tracking-wide text-teal-300 mb-1">
                  Portal Evaluasi Akademik · Tahun Ajaran {settings.academicYear} ({settings.semester})
                </p>
                <h1 className="font-display text-2xl sm:text-3xl font-bold leading-tight text-balance">
                  Sistem Ujian Digital {settings.schoolName}
                </h1>
              </div>
            </div>

            <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between gap-6">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900 mb-2">
                  Pengumuman Akademik
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {settings.announcement}
                </p>
                <p className="mt-3 text-xs text-slate-500">
                  NPSN {settings.npsn} · {settings.address}
                </p>
              </div>

              <div className="border-t border-slate-200 pt-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display text-sm font-semibold text-slate-900">
                    Akun Uji Cepat (3 Batasan Akses)
                  </h3>
                  <span className="text-xs text-slate-500">Klik untuk mengisi form</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {DEMO_ACCOUNTS.map((acc) => (
                    <button
                      key={acc.role}
                      type="button"
                      onClick={() => handleQuickFill(acc.username, acc.password)}
                      className="text-left p-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-white hover:border-teal-600 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 cursor-pointer"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {getRoleIcon(acc.role)}
                        <span className="text-xs font-semibold text-slate-900 truncate">
                          {acc.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 truncate">{acc.detail}</p>
                      <p className="mt-1.5 text-[11px] font-mono tabular-nums text-slate-500 whitespace-nowrap">
                        {acc.username} · sandi {acc.password}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Right Panel: Sign In Form */}
          <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 sm:p-8 flex flex-col justify-center">
            <div className="flex items-center gap-3.5 mb-6">
              <div className="w-12 h-12 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden shrink-0 flex items-center justify-center">
                {!crestImgFailed ? (
                  <img
                    src="./src/assets/images/kartini_crest_1795078071603.jpg"
                    alt="Lambang SMP Kartini 1 Batam"
                    referrerPolicy="no-referrer"
                    onError={() => setCrestImgFailed(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <BookOpen className="w-6 h-6 text-slate-800" />
                )}
              </div>
              <div>
                <h2 className="font-display text-xl font-bold text-slate-900">
                  Masuk Portal Ujian
                </h2>
                <p className="text-xs text-slate-500">
                  Akses terpisah untuk Siswa, Guru, dan Admin
                </p>
              </div>
            </div>

            {settings.maintenanceMode && (
              <div
                role="status"
                className="mb-5 p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs leading-relaxed"
              >
                <strong className="font-semibold">Mode Pemeliharaan Aktif:</strong> Saat ini hanya akun Admin yang dapat melakukan pengelolaan penuh.
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label
                  htmlFor="login-username"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  NIS / NIP / ID Pengguna
                </label>
                <input
                  id="login-username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Contoh: 240901, guru.mtk, atau admin"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
                />
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  Kata Sandi
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan kata sandi"
                    className="w-full px-3.5 py-2.5 pr-11 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-slate-800 rounded-md cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {errorMsg && (
                <div
                  role="alert"
                  className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-800"
                >
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
              >
                <LogIn className="w-4 h-4" />
                <span>Masuk ke Sistem</span>
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-200 text-xs text-slate-500 space-y-1.5">
              <p className="font-medium text-slate-700">Batasan Hak Akses:</p>
              <p>1. Siswa: Mengerjakan soal ujian sesuai kelas dan melihat hasil nilai.</p>
              <p>2. Guru: Menyusun bank soal, memantau progres live, dan mengelola nilai.</p>
              <p>3. Admin: Mengelola data pengguna, jadwal ujian, dan konfigurasi sistem.</p>
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>© 2026 {settings.schoolName} · Kota Batam</span>
          <span>Portal Evaluasi Pembelajaran Berbasis Komputer</span>
        </div>
      </footer>
    </div>
  );
};
