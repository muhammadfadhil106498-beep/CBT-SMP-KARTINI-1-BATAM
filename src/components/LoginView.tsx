import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Eye,
  EyeOff,
  KeyRound,
  LogIn,
  Play,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import type { Exam, SystemSettings, User, UserRole } from '../types/exam';
import {
  authenticateUserForRole,
  findExamByCode,
} from '../utils/examEngine';

interface LoginViewProps {
  users: User[];
  exams: Exam[];
  settings: SystemSettings;
  onLoginSuccess: (user: User) => void;
  onStudentCodeVerified: (exam: Exam) => void;
  onOpenChangePassword: () => void;
}

const DEFAULT_LOGO = './src/assets/images/kartini_crest_1795078071603.jpg';
const DEFAULT_HERO = './src/assets/images/smp_kartini_campus_v2_1795078091161.jpg';

const PORTAL_OPTIONS: Array<{
  id: UserRole;
  label: string;
  subtitle: string;
}> = [
  { id: 'siswa', label: 'Portal Siswa', subtitle: 'Masuk dengan Kode Ujian' },
  { id: 'guru', label: 'Portal Guru', subtitle: 'Login NIP & Kata Sandi' },
  { id: 'admin', label: 'Portal Admin', subtitle: 'Login Proktor & Admin' },
];

export const LoginView: React.FC<LoginViewProps> = ({
  users,
  exams,
  settings,
  onLoginSuccess,
  onStudentCodeVerified,
  onOpenChangePassword,
}) => {
  const [selectedPortal, setSelectedPortal] = useState<UserRole>('siswa');

  // Student Exam Code state (only exam code on index)
  const [examCode, setExamCode] = useState('');

  // Guru / Admin credential state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [campusImgFailed, setCampusImgFailed] = useState(false);
  const [crestImgFailed, setCrestImgFailed] = useState(false);

  const heroSrc = settings.heroImageUrl?.trim() || DEFAULT_HERO;
  const logoSrc = settings.logoUrl?.trim() || DEFAULT_LOGO;

  useEffect(() => {
    setCampusImgFailed(false);
  }, [heroSrc]);

  useEffect(() => {
    setCrestImgFailed(false);
  }, [logoSrc]);

  const activeExams = useMemo(
    () => exams.filter((ex) => ex.status === 'berlangsung'),
    [exams]
  );

  const handlePortalSwitch = (role: UserRole) => {
    setSelectedPortal(role);
    setErrorMsg(null);
    setUsername('');
    setPassword('');
  };

  const handleStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const examRes = findExamByCode(exams, examCode);
    if (examRes.error || !examRes.exam) {
      setErrorMsg(examRes.error ?? 'Kode ujian tidak valid.');
      return;
    }
    setErrorMsg(null);
    onStudentCodeVerified(examRes.exam);
  };

  const handleStaffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const roleTarget: UserRole = selectedPortal === 'admin' ? 'admin' : 'guru';
    const res = authenticateUserForRole(users, username, password, roleTarget);
    if (res.error || !res.user) {
      setErrorMsg(res.error ?? 'Gagal masuk ke sistem.');
      return;
    }
    setErrorMsg(null);
    onLoginSuccess(res.user);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 flex items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left Panel: Custom Institutional Visual, Announcement & Quick Codes */}
          <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between">
            <div className="relative h-64 sm:h-72 lg:h-80 w-full bg-slate-900 overflow-hidden">
              {!campusImgFailed ? (
                <img
                  src={heroSrc}
                  alt={`Lingkungan Kampus ${settings.schoolName}`}
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
                  {settings.announcementTitle?.trim() || 'Pengumuman Akademik'}
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                  {settings.announcement}
                </p>
                <p className="mt-3 text-xs text-slate-500">
                  NPSN {settings.npsn} · {settings.address}
                </p>
              </div>

              <div className="border-t border-slate-200 pt-5">
                {selectedPortal === 'siswa' ? (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-display text-sm font-semibold text-slate-900">
                        Kode Ujian Aktif Saat Ini
                      </h3>
                      <span className="text-xs text-slate-500">
                        Klik untuk mengisi kode
                      </span>
                    </div>
                    {activeExams.length === 0 ? (
                      <p className="text-xs text-slate-500">
                        Belum ada jadwal ujian berstatus berlangsung saat ini.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {activeExams.map((ex) => (
                          <button
                            key={ex.id}
                            type="button"
                            onClick={() => {
                              setExamCode(ex.token);
                              setErrorMsg(null);
                            }}
                            className="text-left p-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-white hover:border-teal-600 transition-colors cursor-pointer"
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800">
                                <BookOpen className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">{ex.subject}</span>
                              </span>
                              <span className="font-mono text-xs font-bold text-slate-900 tabular-nums">
                                {ex.token}
                              </span>
                            </div>
                            <p className="text-xs text-slate-700 font-medium truncate">
                              {ex.title}
                            </p>
                            <p className="mt-1 text-[11px] text-slate-500 font-mono tabular-nums">
                              {ex.targetClass} · {ex.durationMinutes} menit
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-display text-sm font-semibold text-slate-900">
                        Akses Uji Cepat ({selectedPortal === 'guru' ? 'Guru' : 'Admin'})
                      </h3>
                      <span className="text-xs text-slate-500">
                        Klik untuk mengisi form
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {users
                        .filter((u) => u.role === selectedPortal && u.active)
                        .slice(0, 2)
                        .map((acc) => (
                          <button
                            key={acc.id}
                            type="button"
                            onClick={() => {
                              setUsername(acc.username);
                              setPassword(acc.password);
                              setErrorMsg(null);
                            }}
                            className="text-left p-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-white hover:border-teal-600 transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              {acc.role === 'guru' ? (
                                <UserCheck className="w-4 h-4 text-slate-800 shrink-0" />
                              ) : (
                                <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
                              )}
                              <span className="text-xs font-semibold text-slate-900 truncate">
                                {acc.role === 'guru'
                                  ? `Guru · ${acc.mapel || 'Umum'}`
                                  : 'Admin · Proktor'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 truncate">{acc.name}</p>
                            <p className="mt-1.5 text-[11px] font-mono tabular-nums text-slate-500 whitespace-nowrap">
                              {acc.username} · sandi {acc.password}
                            </p>
                          </button>
                        ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>

          {/* Right Panel: Portal Selector (Siswa / Guru / Admin) */}
          <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 sm:p-8 flex flex-col justify-between gap-6">
            <div className="space-y-5">
              {/* Brand Header with Custom Logo */}
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden shrink-0 flex items-center justify-center">
                  {!crestImgFailed ? (
                    <img
                      src={logoSrc}
                      alt={`Logo ${settings.schoolName}`}
                      referrerPolicy="no-referrer"
                      onError={() => setCrestImgFailed(true)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <BookOpen className="w-6 h-6 text-slate-800" />
                  )}
                </div>
                <div className="min-w-0">
                  <h2 className="font-display text-xl font-bold text-slate-900 truncate">
                    Pilih Portal Akses
                  </h2>
                  <p className="text-xs text-slate-500 truncate">
                    {PORTAL_OPTIONS.find((p) => p.id === selectedPortal)?.subtitle}
                  </p>
                </div>
              </div>

              {/* 3-Portal Segmented Switcher */}
              <div
                role="tablist"
                aria-label="Pilihan Portal Login"
                className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg"
              >
                {PORTAL_OPTIONS.map((portal) => {
                  const active = selectedPortal === portal.id;
                  return (
                    <button
                      key={portal.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => handlePortalSwitch(portal.id)}
                      className={`py-2 px-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        active
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {portal.label}
                    </button>
                  );
                })}
              </div>

              {settings.maintenanceMode && (
                <div
                  role="status"
                  className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs leading-relaxed"
                >
                  <strong className="font-semibold">Mode Pemeliharaan Aktif:</strong> Saat ini hanya akun Admin yang dapat melakukan pengelolaan penuh.
                </div>
              )}

              {/* Portal Siswa: Exam Code Only */}
              {selectedPortal === 'siswa' ? (
                <form onSubmit={handleStudentSubmit} className="space-y-4" noValidate>
                  <div>
                    <label
                      htmlFor="student-exam-code"
                      className="block text-sm font-semibold text-slate-800 mb-1.5"
                    >
                      Kode Ujian
                    </label>
                    <input
                      id="student-exam-code"
                      name="examCode"
                      type="text"
                      value={examCode}
                      onChange={(e) => setExamCode(e.target.value.toUpperCase())}
                      placeholder="Masukkan kode ujian, misal: KRT9M1"
                      className="w-full px-3.5 py-2.5 text-sm font-mono uppercase tracking-wider placeholder:normal-case placeholder:tracking-normal bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
                    />
                    <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                      Siswa hanya perlu memasukkan Kode Ujian. Pengisian Nama, Kelas, dan No. Peserta dilakukan setelah kode diverifikasi sebelum mengerjakan soal.
                    </p>
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
                    className="w-full py-2.5 px-4 bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                  >
                    <Play className="w-4 h-4" />
                    <span>Masuk & Isi Identitas Peserta</span>
                  </button>
                </form>
              ) : (
                /* Portal Guru & Portal Admin: Authenticated Login */
                <form onSubmit={handleStaffSubmit} className="space-y-4" noValidate>
                  <div>
                    <label
                      htmlFor="login-username"
                      className="block text-sm font-medium text-slate-700 mb-1.5"
                    >
                      {selectedPortal === 'guru' ? 'NIP / Username Guru' : 'ID Admin / Proktor'}
                    </label>
                    <input
                      id="login-username"
                      name="username"
                      type="text"
                      autoComplete="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder={
                        selectedPortal === 'guru'
                          ? 'Contoh: guru.mtk'
                          : 'Contoh: admin'
                      }
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
                    <span>
                      {selectedPortal === 'guru'
                        ? 'Masuk ke Portal Guru'
                        : 'Masuk ke Portal Admin'}
                    </span>
                  </button>
                </form>
              )}
            </div>

            <div className="pt-4 border-t border-slate-200 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-500">
                  Perlu memperbarui kata sandi akun?
                </span>
                <button
                  type="button"
                  onClick={onOpenChangePassword}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:text-teal-800 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Ganti Password</span>
                </button>
              </div>
              <div className="text-xs text-slate-500 space-y-1">
                <p>1. Siswa: Langsung masuk menggunakan Kode Ujian tanpa kata sandi.</p>
                <p>2. Guru: Menyusun bank soal, memantau progres live, dan mengelola nilai.</p>
                <p>3. Admin: Mengelola pengguna, jadwal ujian, tampilan index, dan konfigurasi.</p>
              </div>
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
