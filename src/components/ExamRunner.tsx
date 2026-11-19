import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  Send,
} from 'lucide-react';
import type { Exam, ExamSubmission, Question } from '../types/exam';
import { formatCountdown } from '../utils/examEngine';

interface ExamRunnerProps {
  exam: Exam;
  questions: Question[];
  submission: ExamSubmission;
  maxTabSwitchWarnings: number;
  onSaveProgress: (updated: ExamSubmission) => void;
  onFinalSubmit: (finalized: ExamSubmission) => void;
  onExitWithoutSubmit: () => void;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E'];

export const ExamRunner: React.FC<ExamRunnerProps> = ({
  exam,
  questions,
  submission,
  maxTabSwitchWarnings,
  onSaveProgress,
  onFinalSubmit,
  onExitWithoutSubmit,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number | string>>(
    submission.answers
  );
  const [flaggedIds, setFlaggedIds] = useState<string[]>(submission.flaggedIds);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(
    submission.remainingSeconds
  );
  const [tabSwitches, setTabSwitches] = useState<number>(submission.tabSwitches);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const currentQuestion = questions[currentIndex];
  const answeredCount = questions.filter((q) => {
    const val = answers[q.id];
    if (q.type === 'pg') return typeof val === 'number';
    return typeof val === 'string' && val.trim().length > 0;
  }).length;

  // Countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-submit when timer hits 0
  useEffect(() => {
    if (remainingSeconds === 0) {
      onFinalSubmit({
        ...submission,
        answers,
        flaggedIds,
        tabSwitches,
        remainingSeconds: 0,
      });
    }
  }, [remainingSeconds]);

  // Tab-switch monitoring
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        setTabSwitches((prev) => prev + 1);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Auto-save whenever answers, flags, or tabSwitches change
  useEffect(() => {
    onSaveProgress({
      ...submission,
      answers,
      flaggedIds,
      tabSwitches,
      remainingSeconds,
    });
  }, [answers, flaggedIds, tabSwitches]);

  const handleSelectOption = (questionId: string, optionIndex: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleEssayChange = (questionId: string, text: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: text }));
  };

  const toggleFlag = (questionId: string) => {
    setFlaggedIds((prev) =>
      prev.includes(questionId)
        ? prev.filter((id) => id !== questionId)
        : [...prev, questionId]
    );
  };

  const handleSubmitConfirm = () => {
    onFinalSubmit({
      ...submission,
      answers,
      flaggedIds,
      tabSwitches,
      remainingSeconds,
    });
  };

  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-6 text-center space-y-4">
          <p className="text-sm text-slate-700">
            Ujian ini belum memiliki butir soal yang ditugaskan oleh guru.
          </p>
          <button
            type="button"
            onClick={onExitWithoutSubmit}
            className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg cursor-pointer"
          >
            Kembali ke Daftar Ujian
          </button>
        </div>
      </div>
    );
  }

  const isFlagged = flaggedIds.includes(currentQuestion.id);
  const timerUrgent = remainingSeconds <= 300;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Focused Exam Header */}
      <header className="sticky top-0 z-20 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs text-slate-500 truncate">
              {exam.subject} · {submission.studentName} ({submission.studentNis})
            </p>
            <h1 className="font-display text-base font-bold text-slate-900 truncate">
              {exam.title}
            </h1>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-mono text-sm font-semibold tabular-nums ${
                timerUrgent
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : 'bg-slate-100 border-slate-200 text-slate-900'
              }`}
              aria-label="Sisa waktu ujian"
            >
              <Clock className="w-4 h-4 shrink-0" />
              <span>{formatCountdown(remainingSeconds)}</span>
            </div>

            <button
              type="button"
              onClick={() => setShowConfirmModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Kumpulkan Ujian</span>
            </button>
          </div>
        </div>
      </header>

      {/* Tab switch integrity warning */}
      {tabSwitches > 0 && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2">
          <div className="max-w-7xl mx-auto flex items-center gap-2 text-xs text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              Tercatat {tabSwitches} kali perpindahan tab/jendela (batas peringatan:{' '}
              {maxTabSwitchWarnings}). Tetap fokus pada halaman ujian.
            </span>
          </div>
        </div>
      )}

      {/* Main Two-Zone CBT Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Zone: Question Stage */}
        <section className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="font-display text-sm font-bold text-slate-900">
                Soal {currentIndex + 1} dari {questions.length}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {currentQuestion.type === 'pg' ? 'Pilihan Ganda' : 'Esai / Uraian'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                Bobot {currentQuestion.points} poin
              </span>
            </div>

            <button
              type="button"
              onClick={() => toggleFlag(currentQuestion.id)}
              aria-pressed={isFlagged}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                isFlagged
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Flag className="w-3.5 h-3.5" />
              <span>{isFlagged ? 'Ditandai Ragu-ragu' : 'Tandai Ragu-ragu'}</span>
            </button>
          </div>

          <div className="text-base text-slate-900 leading-relaxed whitespace-pre-line">
            {currentQuestion.prompt}
          </div>

          {currentQuestion.type === 'pg' && currentQuestion.options ? (
            <div className="space-y-3" role="radiogroup" aria-label="Pilihan jawaban">
              {currentQuestion.options.map((opt, idx) => {
                const selected = answers[currentQuestion.id] === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => handleSelectOption(currentQuestion.id, idx)}
                    className={`w-full text-left p-4 rounded-xl border transition-colors flex items-start gap-3.5 cursor-pointer ${
                      selected
                        ? 'bg-teal-50/70 border-teal-600 text-slate-900'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className={`w-7 h-7 rounded-md font-mono text-xs font-bold flex items-center justify-center shrink-0 border ${
                        selected
                          ? 'bg-teal-700 border-teal-700 text-white'
                          : 'bg-slate-50 border-slate-300 text-slate-700'
                      }`}
                    >
                      {OPTION_LETTERS[idx] ?? idx + 1}
                    </span>
                    <span className="text-sm leading-relaxed pt-0.5">{opt}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div>
              <label
                htmlFor="essay-answer-box"
                className="block text-xs font-semibold text-slate-700 mb-2"
              >
                Jawaban Uraian Anda
              </label>
              <textarea
                id="essay-answer-box"
                rows={7}
                value={
                  typeof answers[currentQuestion.id] === 'string'
                    ? (answers[currentQuestion.id] as string)
                    : ''
                }
                onChange={(e) =>
                  handleEssayChange(currentQuestion.id, e.target.value)
                }
                placeholder="Tuliskan langkah penyelesaian dan jawaban Anda secara lengkap..."
                className="w-full p-4 text-sm bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
              />
            </div>
          )}

          {/* Question Prev/Next Controls */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-4">
            <button
              type="button"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Sebelumnya</span>
            </button>

            {currentIndex < questions.length - 1 ? (
              <button
                type="button"
                onClick={() =>
                  setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))
                }
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-medium cursor-pointer"
              >
                <span>Selanjutnya</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowConfirmModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-sm font-semibold cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Selesai & Kumpulkan</span>
              </button>
            )}
          </div>
        </section>

        {/* Right Zone: Question Navigator Deck */}
        <aside className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div>
            <h2 className="font-display text-sm font-bold text-slate-900">
              Navigasi Nomor Soal
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
              Terjawab {answeredCount} dari {questions.length} soal
            </p>
          </div>

          <div className="grid grid-cols-5 gap-2">
            {questions.map((q, idx) => {
              const val = answers[q.id];
              const isAnswered =
                q.type === 'pg'
                  ? typeof val === 'number'
                  : typeof val === 'string' && val.trim().length > 0;
              const isCurrent = idx === currentIndex;
              const qFlagged = flaggedIds.includes(q.id);

              let style = 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100';
              if (qFlagged) {
                style = 'bg-amber-50 border-amber-300 text-amber-900';
              } else if (isAnswered) {
                style = 'bg-teal-700 border-teal-700 text-white';
              }

              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  aria-label={`Soal nomor ${idx + 1}${
                    qFlagged ? ', ragu-ragu' : isAnswered ? ', sudah dijawab' : ', belum dijawab'
                  }`}
                  className={`h-10 rounded-lg border font-mono text-xs font-semibold tabular-nums flex items-center justify-center relative cursor-pointer ${style} ${
                    isCurrent ? 'ring-2 ring-slate-900 ring-offset-1' : ''
                  }`}
                >
                  <span>{idx + 1}</span>
                </button>
              );
            })}
          </div>

          <div className="pt-4 border-t border-slate-200 space-y-2 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-teal-700 inline-block shrink-0" />
              <span>Sudah dijawab</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-amber-50 border border-amber-300 inline-block shrink-0" />
              <span>Ditandai ragu-ragu</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-slate-50 border border-slate-200 inline-block shrink-0" />
              <span>Belum dijawab</span>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onExitWithoutSubmit}
              className="w-full py-2 px-3 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              Simpan Sementara & Kembali ke Beranda
            </button>
          </div>
        </aside>
      </main>

      {/* Final Submit Confirmation Modal */}
      {showConfirmModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-submit-title"
          className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4">
            <h2
              id="confirm-submit-title"
              className="font-display text-lg font-bold text-slate-900"
            >
              Konfirmasi Pengumpulan Ujian
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Anda telah menjawab{' '}
              <strong className="font-mono tabular-nums text-slate-900">
                {answeredCount} dari {questions.length}
              </strong>{' '}
              soal. Setelah dikumpulkan, jawaban tidak dapat diubah kembali.
            </p>
            {flaggedIds.length > 0 && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                Masih ada {flaggedIds.length} soal yang ditandai ragu-ragu.
              </p>
            )}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Periksa Kembali
              </button>
              <button
                type="button"
                onClick={handleSubmitConfirm}
                className="px-4 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
              >
                Ya, Kumpulkan Sekarang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
