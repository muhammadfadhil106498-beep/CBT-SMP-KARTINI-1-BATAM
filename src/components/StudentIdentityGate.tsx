import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock,
  FileText,
  Maximize2,
  Play,
  ShieldAlert,
  UserCheck,
  Volume2,
} from 'lucide-react';
import type { Exam, ExamSubmission, SystemSettings, User } from '../types/exam';
import {
  lookupRegisteredParticipantForExam,
  resolveParticipantForExam,
} from '../utils/examEngine';
import {
  playVolumeTestTone,
  requestExamFullscreen,
} from '../utils/examProctor';

interface StudentIdentityGateProps {
  exam: Exam;
  users: User[];
  submissions: ExamSubmission[];
  settings: SystemSettings;
  onBack: () => void;
  onConfirm: (student: User) => void;
}

export const StudentIdentityGate: React.FC<StudentIdentityGateProps> = ({
  exam,
  users,
  submissions,
  settings,
  onBack,
  onConfirm,
}) => {
  const [participantNumber, setParticipantNumber] = useState('');
  const [soundTested, setSoundTested] = useState(false);
  const [deviceReadyConfirmed, setDeviceReadyConfirmed] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const maxWarnings = Math.max(1, settings.maxTabSwitchWarnings || 3);

  const lookup = useMemo(
    () =>
      lookupRegisteredParticipantForExam(
        users,
        exam,
        participantNumber,
        submissions
      ),
    [users, exam, participantNumber, submissions]
  );

  const autoFilledName = lookup.student?.name ?? '';
  const autoFilledClass = lookup.student?.kelas ?? '';
  const isIdentityVerified =
    lookup.status === 'valid' &&
    Boolean(autoFilledName) &&
    Boolean(autoFilledClass);
  const canStart = isIdentityVerified && deviceReadyConfirmed;

  const handleTestVolume = () => {
    playVolumeTestTone();
    setSoundTested(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = resolveParticipantForExam(
      users,
      exam,
      {
        name: autoFilledName,
        kelas: autoFilledClass,
        participantNumber,
      },
      submissions
    );
    if (res.error || !res.student) {
      setErrorMsg(
        res.error ??
          'No. Peserta wajib terdaftar di Manajemen Data Pengguna hingga Nama dan Kelas muncul otomatis.'
      );
      return;
    }

    if (!deviceReadyConfirmed) {
      setErrorMsg(
        'Pastikan volume media perangkat penuh (100%) dan centang pernyataan siap mode Layar Penuh (Fullscreen) sebelum memulai ujian.'
      );
      return;
    }

    setErrorMsg(null);
    playVolumeTestTone();
    await requestExamFullscreen();
    onConfirm(res.student);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs text-teal-700 font-semibold truncate">
              {settings.schoolName} · Kode Ujian {exam.token}
            </p>
            <h1 className="font-display text-base font-bold text-slate-900 truncate">
              Verifikasi Nomor Peserta Ujian
            </h1>
          </div>

          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Kembali</span>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 flex items-center">
        <div className="w-full grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Exam Overview Card */}
          <section className="md:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700">
                <BookOpen className="w-3.5 h-3.5" />
                <span>{exam.subject}</span>
              </span>
              <h2 className="font-display text-lg font-bold text-slate-900 leading-snug">
                {exam.title}
              </h2>
              <p className="text-xs text-slate-500">Pengampu: {exam.teacherName}</p>
            </div>

            <div className="pt-3 border-t border-slate-200 space-y-2.5 text-xs text-slate-700">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Kode Ujian</span>
                <span className="font-mono font-bold text-slate-900 tabular-nums">
                  {exam.token}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Target Kelas</span>
                <span className="font-semibold text-slate-900">{exam.targetClass}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Durasi</span>
                </span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {exam.durationMinutes} menit
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" />
                  <span>Jumlah Soal</span>
                </span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {exam.questionIds.length} butir
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-950 leading-relaxed flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">Akses Terdaftar &amp; Aturan Ketat</p>
                <p>
                  Hanya No. Peserta terdaftar di Manajemen Data Pengguna yang dapat masuk (1x pengerjaan). Wajib layar penuh, volume media penuh, dan maks. {maxWarnings} kali peringatan pindah tab.
                </p>
              </div>
            </div>
          </section>

          {/* Identity Verification Form Card */}
          <section className="md:col-span-7 bg-white border border-slate-200 rounded-xl p-6 sm:p-7">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-9 h-9 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center shrink-0">
                <UserCheck className="w-4 h-4 text-teal-700" />
              </div>
              <div>
                <h2 className="font-display text-base font-bold text-slate-900">
                  Masukkan Nomor Peserta Resmi
                </h2>
                <p className="text-xs text-slate-500">
                  Nama Peserta dan Kelas muncul otomatis apabila nomor peserta terdaftar.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label
                  htmlFor="participant-number"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  No. Peserta / NIS
                </label>
                <input
                  id="participant-number"
                  name="participantNumber"
                  type="text"
                  autoFocus
                  value={participantNumber}
                  onChange={(e) => {
                    setParticipantNumber(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="Masukkan No. Peserta terdaftar (misal: 240901)"
                  className="w-full px-3.5 py-2.5 text-sm font-mono bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 placeholder:font-sans focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Harus sesuai dengan daftar siswa pada Manajemen Data Pengguna sekolah.
                </p>
              </div>

              {/* Auto-populated Data Peserta Columns */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-800">
                    Data Peserta (Otomatis dari Sistem)
                  </span>
                  {isIdentityVerified && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Terverifikasi</span>
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="participant-name"
                      className="block text-xs font-medium text-slate-600 mb-1"
                    >
                      Nama Peserta
                    </label>
                    <input
                      id="participant-name"
                      name="participantName"
                      type="text"
                      readOnly
                      value={autoFilledName}
                      placeholder="Muncul otomatis jika No. Peserta benar"
                      className="w-full px-3 py-2 text-sm font-medium bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="participant-class"
                      className="block text-xs font-medium text-slate-600 mb-1"
                    >
                      Kelas
                    </label>
                    <input
                      id="participant-class"
                      name="participantClass"
                      type="text"
                      readOnly
                      value={autoFilledClass}
                      placeholder="-"
                      className="w-full px-3 py-2 text-sm font-mono font-semibold bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none"
                    />
                  </div>
                </div>

                {lookup.status !== 'empty' && lookup.error && (
                  <div
                    role="alert"
                    className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-800"
                  >
                    {lookup.error}
                  </div>
                )}

                {isIdentityVerified && (
                  <p className="text-xs text-teal-800 font-medium">
                    Identitas valid: {autoFilledName} · Kelas {autoFilledClass}. Silakan uji suara dan mulai ujian.
                  </p>
                )}
              </div>

              {/* Mandatory Full Volume & Fullscreen Readiness */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                    <Volume2 className="w-4 h-4 text-teal-700 shrink-0" />
                    <span>Kesiapan Volume Penuh &amp; Layar Penuh</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleTestVolume}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 hover:bg-teal-100 rounded-lg cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Uji Suara (Volume 100%)</span>
                  </button>
                </div>

                {soundTested && (
                  <p className="text-xs text-teal-800 font-medium">
                    Nada uji berbunyi pada volume media 100%. Pastikan speaker/headset perangkat Anda aktif penuh.
                  </p>
                )}

                <label
                  htmlFor="device-ready-check"
                  className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer leading-relaxed"
                >
                  <input
                    id="device-ready-check"
                    type="checkbox"
                    checked={deviceReadyConfirmed}
                    onChange={(e) => setDeviceReadyConfirmed(e.target.checked)}
                    className="mt-0.5 accent-teal-700"
                  />
                  <span>
                    Saya memastikan volume media perangkat penuh (100%) dan siap mengikuti ujian dalam mode Layar Penuh (Fullscreen) tanpa pindah tab atau keluar browser.
                  </span>
                </label>
              </div>

              {errorMsg && (
                <div
                  role="alert"
                  className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-800"
                >
                  {errorMsg}
                </div>
              )}

              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onBack}
                  className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  Ubah Kode Ujian
                </button>
                <button
                  type="submit"
                  disabled={!canStart}
                  className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 disabled:bg-slate-300 disabled:text-slate-600 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Maximize2 className="w-4 h-4" />
                  <Play className="w-4 h-4" />
                  <span>Masuk Layar Penuh &amp; Mulai Soal</span>
                </button>
              </div>
            </form>
          </section>
        </div>
      </main>
    </div>
  );
};
