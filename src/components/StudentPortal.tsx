import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  KeyRound,
  Play,
  Search,
} from 'lucide-react';
import type {
  Exam,
  ExamSubmission,
  Question,
  SystemSettings,
  User,
} from '../types/exam';
import {
  isClassEligibleForExam,
  PortalTab,
  validateExamToken,
} from '../utils/examEngine';

interface StudentPortalProps {
  user: User;
  activeTab: PortalTab;
  exams: Exam[];
  questions: Question[];
  submissions: ExamSubmission[];
  settings: SystemSettings;
  onStartExam: (exam: Exam) => void;
}

export const StudentPortal: React.FC<StudentPortalProps> = ({
  user,
  activeTab,
  exams,
  questions,
  submissions,
  settings,
  onStartExam,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'semua' | 'berlangsung' | 'terjadwal' | 'selesai'
  >('semua');
  const [tokenModalExam, setTokenModalExam] = useState<Exam | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [tokenError, setTokenError] = useState<string | null>(null);

  const studentExams = useMemo(() => {
    return exams.filter(
      (ex) =>
        ex.status !== 'draft' &&
        isClassEligibleForExam(user.kelas, ex.targetClass)
    );
  }, [exams, user.kelas]);

  const filteredExams = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return studentExams.filter((ex) => {
      const matchesFilter =
        statusFilter === 'semua' ? true : ex.status === statusFilter;
      const matchesQuery =
        !q ||
        ex.title.toLowerCase().includes(q) ||
        ex.subject.toLowerCase().includes(q);
      return matchesFilter && matchesQuery;
    });
  }, [studentExams, searchQuery, statusFilter]);

  const mySubmissions = useMemo(() => {
    return submissions.filter((s) => s.studentId === user.id);
  }, [submissions, user.id]);

  const handleOpenExam = (exam: Exam) => {
    const existing = mySubmissions.find((s) => s.examId === exam.id);
    if (existing && existing.status === 'sedang_mengerjakan') {
      onStartExam(exam);
      return;
    }

    if (exam.requireToken || settings.defaultRequireToken) {
      setTokenModalExam(exam);
      setTokenInput('');
      setTokenError(null);
      return;
    }

    onStartExam(exam);
  };

  const handleVerifyToken = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenModalExam) return;
    const check = validateExamToken(
      tokenModalExam,
      tokenInput,
      settings.defaultRequireToken
    );
    if (!check.valid) {
      setTokenError(check.reason ?? 'Token ujian tidak valid.');
      return;
    }
    const target = tokenModalExam;
    setTokenModalExam(null);
    setTokenError(null);
    onStartExam(target);
  };

  if (activeTab === 'siswa-nilai') {
    const completedSubs = mySubmissions.filter((s) => s.status === 'selesai');
    const avg =
      completedSubs.length > 0
        ? Math.round(
            (completedSubs.reduce((acc, s) => acc + s.finalScore, 0) /
              completedSubs.length) *
              10
          ) / 10
        : 0;

    const autoSubmittedNotice = completedSubs.find((s) => Boolean(s.autoSubmittedReason));

    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900">
              Riwayat Nilai Ujian
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              {user.name} · No. Peserta {user.username} · Kelas {user.kelas}
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl px-5 py-3 flex items-center gap-6">
            <div>
              <p className="text-xs text-slate-500">Ujian Selesai</p>
              <p className="font-mono text-xl font-bold text-slate-900 tabular-nums">
                {completedSubs.length}
              </p>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div>
              <p className="text-xs text-slate-500">Rata-rata Nilai</p>
              <p className="font-mono text-xl font-bold text-teal-700 tabular-nums">
                {avg}
              </p>
            </div>
          </div>
        </div>

        {autoSubmittedNotice && (
          <div
            role="status"
            className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-xs text-amber-950"
          >
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold">Ujian Dinyatakan Selesai Otomatis</p>
              <p>{autoSubmittedNotice.autoSubmittedReason}</p>
            </div>
          </div>
        )}

        {completedSubs.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-2">
            <FileText className="w-8 h-8 text-slate-400 mx-auto" />
            <h2 className="font-display text-base font-semibold text-slate-900">
              Belum Ada Nilai Tersimpan
            </h2>
            <p className="text-sm text-slate-600">
              Selesaikan salah satu ujian aktif di menu Daftar Ujian untuk melihat hasil penilaian Anda.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-3.5 px-5">Nama Ujian</th>
                    <th className="py-3.5 px-4">Mata Pelajaran</th>
                    <th className="py-3.5 px-4 text-right">Skor PG</th>
                    <th className="py-3.5 px-4 text-right">Skor Esai</th>
                    <th className="py-3.5 px-4 text-right">Nilai Akhir</th>
                    <th className="py-3.5 px-5">Status Penilaian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {completedSubs.map((sub) => {
                    const exam = exams.find((e) => e.id === sub.examId);
                    if (!exam) return null;
                    const examQuestions = questions.filter((q) =>
                      exam.questionIds.includes(q.id)
                    );
                    const hasEssay = examQuestions.some((q) => q.type === 'esai');
                    const gradedAllEssays = examQuestions
                      .filter((q) => q.type === 'esai')
                      .every((q) =>
                        Object.prototype.hasOwnProperty.call(sub.essayScores, q.id)
                      );
                    const canPreview =
                      exam.showResultToStudent && settings.allowStudentScorePreview;

                    return (
                      <tr key={sub.id} className="hover:bg-slate-50">
                        <td className="py-3.5 px-5 font-medium text-slate-900">
                          {exam.title}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {exam.subject}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700">
                          {canPreview ? sub.autoScore : '-'}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700">
                          {canPreview ? sub.essayScoreTotal : '-'}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold tabular-nums text-slate-900">
                          {canPreview ? sub.finalScore : 'Menunggu Rilis'}
                        </td>
                        <td className="py-3.5 px-5 text-xs">
                          {hasEssay && !gradedAllEssays ? (
                            <span className="inline-flex items-center gap-1.5 text-amber-800 font-medium">
                              <Clock className="w-3.5 h-3.5" />
                              Menunggu Koreksi Esai
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Nilai Final
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header & Overview */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-teal-700 mb-1">
            Ruang Peserta Didik · Kelas {user.kelas} · No. Peserta {user.username}
          </p>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Selamat Datang, {user.name}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Pilih ujian yang sedang berlangsung untuk mulai mengerjakan soal.
          </p>
        </div>

        {/* Search & Status Segmented Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari mata pelajaran..."
              aria-label="Cari ujian"
              className="pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(
              [
                { id: 'semua', label: 'Semua' },
                { id: 'berlangsung', label: 'Aktif' },
                { id: 'terjadwal', label: 'Terjadwal' },
                { id: 'selesai', label: 'Selesai' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Exam Grid */}
      {filteredExams.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-2">
          <FileText className="w-8 h-8 text-slate-400 mx-auto" />
          <h2 className="font-display text-base font-semibold text-slate-900">
            Tidak Ada Ujian Ditemukan
          </h2>
          <p className="text-sm text-slate-600">
            Belum ada jadwal ujian untuk kelas {user.kelas} pada filter ini.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredExams.map((exam) => {
            const sub = mySubmissions.find((s) => s.examId === exam.id);
            const isCompleted = sub?.status === 'selesai';
            const isInProgress = sub?.status === 'sedang_mengerjakan';
            const needsToken = exam.requireToken || settings.defaultRequireToken;

            return (
              <article
                key={exam.id}
                className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between gap-5"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span>
                      {exam.subject} · {exam.room}
                    </span>
                    {exam.status === 'berlangsung' && (
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                        <Play className="w-3 h-3 fill-current" />
                        <span>Berlangsung</span>
                      </span>
                    )}
                    {exam.status === 'terjadwal' && (
                      <span className="font-semibold text-amber-700">
                        Terjadwal
                      </span>
                    )}
                    {exam.status === 'selesai' && (
                      <span className="font-medium text-slate-500">Selesai</span>
                    )}
                  </div>

                  <h2 className="font-display text-lg font-bold text-slate-900 leading-snug">
                    {exam.title}
                  </h2>

                  <div className="text-xs text-slate-600 space-y-1">
                    <p>Pengampu: {exam.teacherName}</p>
                    <p className="font-mono tabular-nums">
                      Durasi {exam.durationMinutes} menit · {exam.questionIds.length} butir soal
                    </p>
                    {needsToken && !isCompleted && (
                      <p className="inline-flex items-center gap-1 text-slate-700 font-medium pt-0.5">
                        <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                        Memerlukan token ujian
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
                  {isCompleted ? (
                    <div className="w-full flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 className="w-4 h-4" />
                        Sudah Dikumpulkan
                      </span>
                      {exam.showResultToStudent &&
                        settings.allowStudentScorePreview && (
                          <span className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                            Nilai: {sub.finalScore}
                          </span>
                        )}
                    </div>
                  ) : exam.status === 'berlangsung' ? (
                    <button
                      type="button"
                      onClick={() => handleOpenExam(exam)}
                      className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Play className="w-4 h-4" />
                      <span>
                        {isInProgress ? 'Lanjutkan Ujian' : 'Mulai Kerjakan'}
                      </span>
                    </button>
                  ) : (
                    <span className="text-xs text-slate-500">
                      {exam.status === 'terjadwal'
                        ? `Mulai ${exam.startTime.replace('T', ' ')}`
                        : 'Sesi ujian telah ditutup'}
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Token Modal */}
      {tokenModalExam && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="token-modal-title"
          className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleVerifyToken}
            className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4"
          >
            <div>
              <h2
                id="token-modal-title"
                className="font-display text-lg font-bold text-slate-900"
              >
                Masukkan Token Ujian
              </h2>
              <p className="text-xs text-slate-600 mt-1">
                {tokenModalExam.title} · Token demo ujian ini adalah{' '}
                <strong className="font-mono text-slate-900">
                  {tokenModalExam.token}
                </strong>
              </p>
            </div>

            <div>
              <label
                htmlFor="exam-token-input"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Kode Token (6 karakter)
              </label>
              <input
                id="exam-token-input"
                type="text"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
                placeholder="Contoh: IPA9B2"
                className="w-full px-3.5 py-2.5 text-sm font-mono uppercase tracking-wider bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </div>

            {tokenError && (
              <p role="alert" className="text-xs font-medium text-red-700">
                {tokenError}
              </p>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setTokenModalExam(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
              >
                Verifikasi & Mulai
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
