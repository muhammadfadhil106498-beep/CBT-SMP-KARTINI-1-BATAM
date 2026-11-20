import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  Lock,
  Maximize2,
  Send,
  ShieldAlert,
  Volume2,
} from 'lucide-react';
import type {
  Exam,
  ExamSubmission,
  Question,
  QuestionAnswerValue,
} from '../types/exam';
import {
  evaluateTabSwitchViolation,
  formatCountdown,
  isQuestionAnswered,
  QUESTION_TYPE_LABELS,
} from '../utils/examEngine';
import {
  exitExamFullscreen,
  isCurrentlyFullscreen,
  isFullscreenSupported,
  playViolationAlertSound,
  requestExamFullscreen,
} from '../utils/examProctor';

interface ExamRunnerProps {
  exam: Exam;
  questions: Question[];
  submission: ExamSubmission;
  maxTabSwitchWarnings: number;
  onSaveProgress: (updated: ExamSubmission) => void;
  onFinalSubmit: (finalized: ExamSubmission) => void;
  onExitWithoutSubmit: () => void;
  onLogExamEvent?: (action: string, detail: string) => void;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E'];

function deterministicShuffle(items: string[], seedStr: string): string[] {
  const copy = [...items];
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) {
    seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
  }
  for (let i = copy.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const j = seed % (i + 1);
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

export const ExamRunner: React.FC<ExamRunnerProps> = ({
  exam,
  questions,
  submission,
  maxTabSwitchWarnings,
  onSaveProgress,
  onFinalSubmit,
  onExitWithoutSubmit,
  onLogExamEvent,
}) => {
  const maxWarnings = Math.max(1, maxTabSwitchWarnings || 3);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, QuestionAnswerValue>>(
    submission.answers
  );
  const [flaggedIds, setFlaggedIds] = useState<string[]>(submission.flaggedIds);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(
    submission.remainingSeconds
  );
  const [tabSwitches, setTabSwitches] = useState<number>(submission.tabSwitches);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [lockReason, setLockReason] = useState<string>(
    'Anda terdeteksi meninggalkan halaman atau membuka tab lain saat ujian berlangsung.'
  );
  const [unlockCodeInput, setUnlockCodeInput] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() =>
    isCurrentlyFullscreen()
  );

  // Refs prevent stale closures inside timer / visibility listeners and avoid double-counting
  const isLockedRef = useRef(false);
  const isSubmittedRef = useRef(false);
  const wasFullscreenRef = useRef(isCurrentlyFullscreen());
  const lastViolationAtRef = useRef(0);
  const latestStateRef = useRef({
    answers,
    flaggedIds,
    tabSwitches,
    remainingSeconds,
  });

  useEffect(() => {
    isLockedRef.current = isLocked;
  }, [isLocked]);

  useEffect(() => {
    latestStateRef.current = {
      answers,
      flaggedIds,
      tabSwitches,
      remainingSeconds,
    };
  }, [answers, flaggedIds, tabSwitches, remainingSeconds]);

  const currentQuestion = questions[currentIndex];
  const answeredCount = questions.filter((q) =>
    isQuestionAnswered(q, answers[q.id])
  ).length;

  const matchingRightOptions = useMemo(() => {
    if (!currentQuestion || currentQuestion.type !== 'menjodohkan') return [];
    const rights = (currentQuestion.matchingPairs ?? []).map((p) => p.right);
    return deterministicShuffle(rights, `${currentQuestion.id}-${submission.id}`);
  }, [currentQuestion, submission.id]);

  const enforceMaxVolume = (
    e: React.SyntheticEvent<HTMLMediaElement, Event>
  ) => {
    const media = e.currentTarget;
    if (media.muted) media.muted = false;
    if (media.volume !== 1) media.volume = 1;
  };

  // Attempt automatic fullscreen when entering exam and exit fullscreen after completion
  useEffect(() => {
    requestExamFullscreen().then((entered) => {
      if (entered) {
        wasFullscreenRef.current = true;
        setIsFullscreen(true);
      }
    });
    return () => {
      exitExamFullscreen();
    };
  }, []);

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
    if (remainingSeconds === 0 && !isSubmittedRef.current) {
      isSubmittedRef.current = true;
      exitExamFullscreen();
      onFinalSubmit({
        ...submission,
        ...latestStateRef.current,
        remainingSeconds: 0,
        autoSubmittedReason: 'Waktu pengerjaan ujian telah habis.',
      });
    }
  }, [remainingSeconds]);

  // Anti-cheat: tab switch, browser blur, fullscreen exit, beforeunload, copy/contextmenu block
  useEffect(() => {
    const registerViolation = (actionLabel: string, reasonText: string) => {
      if (isSubmittedRef.current || isLockedRef.current) return;
      const now = Date.now();
      if (now - lastViolationAtRef.current < 1000) return;
      lastViolationAtRef.current = now;

      const snapshot = latestStateRef.current;
      const outcome = evaluateTabSwitchViolation(snapshot.tabSwitches, maxWarnings);

      setTabSwitches(outcome.nextSwitches);
      setLockReason(reasonText);
      playViolationAlertSound(outcome.nextSwitches, outcome.shouldAutoSubmit);

      onLogExamEvent?.(
        actionLabel,
        `${reasonText} (Pelanggaran ke-${outcome.nextSwitches} dari ${maxWarnings})`
      );

      if (outcome.shouldAutoSubmit) {
        isSubmittedRef.current = true;
        isLockedRef.current = false;
        setIsLocked(false);
        exitExamFullscreen();
        onFinalSubmit({
          ...submission,
          answers: snapshot.answers,
          flaggedIds: snapshot.flaggedIds,
          remainingSeconds: snapshot.remainingSeconds,
          tabSwitches: outcome.nextSwitches,
          autoSubmittedReason: `Siswa terdeteksi melanggar pengawasan (${reasonText}) sebanyak ${outcome.nextSwitches} kali. Ujian dinyatakan selesai dan jawaban dikirim otomatis.`,
        });
        return;
      }

      isLockedRef.current = true;
      setIsLocked(true);
      setUnlockCodeInput('');
      setUnlockError(null);
      onSaveProgress({
        ...submission,
        answers: snapshot.answers,
        flaggedIds: snapshot.flaggedIds,
        remainingSeconds: snapshot.remainingSeconds,
        tabSwitches: outcome.nextSwitches,
      });
    };

    const handleVisibility = () => {
      if (document.hidden) {
        registerViolation(
          'Pelanggaran Tab',
          'Meninggalkan tab ujian atau meminimalkan jendela browser.'
        );
      }
    };

    let blurTimer: ReturnType<typeof setTimeout> | null = null;
    const handleWindowBlur = () => {
      if (blurTimer) clearTimeout(blurTimer);
      blurTimer = setTimeout(() => {
        if (!document.hasFocus() || document.hidden) {
          registerViolation(
            'Pelanggaran Tab',
            'Fokus browser berpindah ke jendela atau aplikasi lain.'
          );
        }
      }, 150);
    };

    const handleFullscreenChange = () => {
      const active = isCurrentlyFullscreen();
      setIsFullscreen(active);
      if (active) {
        wasFullscreenRef.current = true;
        return;
      }
      if (wasFullscreenRef.current && !isSubmittedRef.current) {
        registerViolation(
          'Keluar Layar Penuh',
          'Keluar dari mode Layar Penuh (Fullscreen) saat ujian berlangsung.'
        );
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isSubmittedRef.current) return;
      e.preventDefault();
      e.returnValue =
        'Ujian sedang berlangsung. Meninggalkan halaman akan mencatat pelanggaran.';
    };

    const blockContext = (e: MouseEvent) => e.preventDefault();
    const blockCopyCut = (e: ClipboardEvent) => e.preventDefault();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'F12' ||
        ((e.ctrlKey || e.metaKey) &&
          ['c', 'x', 'u', 'i', 'j'].includes(e.key.toLowerCase()))
      ) {
        e.preventDefault();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('contextmenu', blockContext);
    document.addEventListener('copy', blockCopyCut);
    document.addEventListener('cut', blockCopyCut);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      if (blurTimer) clearTimeout(blurTimer);
      document.removeEventListener('visibilitychange', handleVisibility);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('contextmenu', blockContext);
      document.removeEventListener('copy', blockCopyCut);
      document.removeEventListener('cut', blockCopyCut);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [maxWarnings]);

  // Auto-save whenever answers, flags, or tabSwitches change
  useEffect(() => {
    if (isSubmittedRef.current) return;
    onSaveProgress({
      ...submission,
      answers,
      flaggedIds,
      tabSwitches,
      remainingSeconds,
    });
  }, [answers, flaggedIds, tabSwitches]);

  const handleSelectSingle = (questionId: string, optionIndex: number) => {
    if (isLocked) return;
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleToggleComplexOption = (questionId: string, optionIndex: number) => {
    if (isLocked) return;
    setAnswers((prev) => {
      const current = Array.isArray(prev[questionId])
        ? (prev[questionId] as number[])
        : [];
      const next = current.includes(optionIndex)
        ? current.filter((idx) => idx !== optionIndex)
        : [...current, optionIndex].sort((a, b) => a - b);
      return { ...prev, [questionId]: next };
    });
  };

  const handleSelectTrueFalse = (
    questionId: string,
    statementIndex: number,
    value: boolean
  ) => {
    if (isLocked) return;
    setAnswers((prev) => {
      const prevVal = prev[questionId];
      const currentMap: Record<number, boolean> =
        prevVal && typeof prevVal === 'object' && !Array.isArray(prevVal)
          ? { ...(prevVal as Record<number, boolean>) }
          : {};
      currentMap[statementIndex] = value;
      return { ...prev, [questionId]: currentMap };
    });
  };

  const handleSelectMatching = (
    questionId: string,
    pairIndex: number,
    chosenRight: string
  ) => {
    if (isLocked) return;
    setAnswers((prev) => {
      const prevVal = prev[questionId];
      const currentMap: Record<number, string> =
        prevVal && typeof prevVal === 'object' && !Array.isArray(prevVal)
          ? { ...(prevVal as Record<number, string>) }
          : {};
      currentMap[pairIndex] = chosenRight;
      return { ...prev, [questionId]: currentMap };
    });
  };

  const handleEssayChange = (questionId: string, text: string) => {
    if (isLocked) return;
    setAnswers((prev) => ({ ...prev, [questionId]: text }));
  };

  const toggleFlag = (questionId: string) => {
    if (isLocked) return;
    setFlaggedIds((prev) =>
      prev.includes(questionId)
        ? prev.filter((id) => id !== questionId)
        : [...prev, questionId]
    );
  };

  const handleEnterFullscreenClick = async () => {
    const ok = await requestExamFullscreen();
    if (ok) {
      wasFullscreenRef.current = true;
      setIsFullscreen(true);
    }
  };

  const handleUnlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const entered = unlockCodeInput.trim().toUpperCase();
    const expected = exam.token.trim().toUpperCase();
    if (!entered) {
      setUnlockError('Masukkan kembali kode ujian untuk membuka kunci layar.');
      return;
    }
    if (entered !== expected) {
      setUnlockError(
        'Kode ujian tidak sesuai. Pastikan kode ujian benar atau hubungi pengawas.'
      );
      return;
    }
    setUnlockError(null);
    setUnlockCodeInput('');
    const fsEntered = await requestExamFullscreen();
    if (fsEntered) {
      wasFullscreenRef.current = true;
      setIsFullscreen(true);
    }
    isLockedRef.current = false;
    setIsLocked(false);
    onLogExamEvent?.(
      'Buka Kunci Layar',
      `Peserta membuka kunci layar setelah pelanggaran ke-${tabSwitches}`
    );
  };

  const handleSubmitConfirm = () => {
    if (isSubmittedRef.current) return;
    isSubmittedRef.current = true;
    exitExamFullscreen();
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
            onClick={() => {
              exitExamFullscreen();
              onExitWithoutSubmit();
            }}
            className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg cursor-pointer"
          >
            Kembali ke Beranda
          </button>
        </div>
      </div>
    );
  }

  const isFlagged = flaggedIds.includes(currentQuestion.id);
  const timerUrgent = remainingSeconds <= 300;
  const remainingTolerance = Math.max(0, maxWarnings - tabSwitches);
  const fullscreenAvailable = isFullscreenSupported();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col select-none">
      {/* Focused Exam Header */}
      <header className="sticky top-0 z-20 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs text-slate-500 truncate">
              {exam.subject} · Kode {exam.token} · {submission.studentName} ({submission.studentClass} · No. {submission.studentNis})
            </p>
            <h1 className="font-display text-base font-bold text-slate-900 truncate">
              {exam.title}
            </h1>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700">
              <Volume2 className="w-3.5 h-3.5 text-teal-700" />
              <span>Volume 100%</span>
            </span>

            {fullscreenAvailable && !isFullscreen && (
              <button
                type="button"
                onClick={handleEnterFullscreenClick}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-semibold cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Wajib Layar Penuh</span>
              </button>
            )}

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

      {/* Active Integrity Banner */}
      {tabSwitches > 0 ? (
        <div
          role="alert"
          className="bg-red-50 border-b border-red-200 px-4 py-2.5"
        >
          <div className="max-w-7xl mx-auto flex items-center gap-2 text-xs font-medium text-red-900">
            <AlertTriangle className="w-4 h-4 text-red-700 shrink-0" />
            <span>
              Peringatan Pelanggaran ({tabSwitches} dari {maxWarnings}): Sisa toleransi{' '}
              {remainingTolerance} kali lagi sebelum ujian selesai dan dikirim otomatis.
            </span>
          </div>
        </div>
      ) : (
        <div className="bg-slate-100 border-b border-slate-200 px-4 py-2">
          <div className="max-w-7xl mx-auto flex items-center gap-2 text-xs text-slate-700">
            <ShieldAlert className="w-4 h-4 text-teal-700 shrink-0" />
            <span>
              Pengawasan Aktif: Wajib mode Layar Penuh, volume penuh, dilarang pindah tab atau keluar browser. Pelanggaran berbunyi alarm &amp; maksimal {maxWarnings} kali mengakhiri ujian otomatis.
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
              <span className="font-medium text-teal-700">
                {QUESTION_TYPE_LABELS[currentQuestion.type]}
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

          {/* Optional Question Media */}
          {currentQuestion.media && currentQuestion.media.url && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              {currentQuestion.media.type === 'image' && (
                <img
                  src={currentQuestion.media.url}
                  alt={currentQuestion.media.name || `Media soal nomor ${currentIndex + 1}`}
                  referrerPolicy="no-referrer"
                  className="max-h-72 w-auto mx-auto rounded-lg border border-slate-200 object-contain bg-white"
                />
              )}
              {currentQuestion.media.type === 'audio' && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span className="font-semibold text-slate-800">
                      Audio Soal {currentQuestion.media.name ? `· ${currentQuestion.media.name}` : ''}
                    </span>
                    <span className="font-mono text-teal-700">Volume dikunci 100%</span>
                  </div>
                  <audio
                    controls
                    controlsList="nodownload noplaybackrate"
                    src={currentQuestion.media.url}
                    onLoadedMetadata={enforceMaxVolume}
                    onPlay={enforceMaxVolume}
                    onVolumeChange={enforceMaxVolume}
                    className="w-full"
                  />
                </div>
              )}
              {currentQuestion.media.type === 'video' && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span className="font-semibold text-slate-800">
                      Video Soal {currentQuestion.media.name ? `· ${currentQuestion.media.name}` : ''}
                    </span>
                    <span className="font-mono text-teal-700">Volume dikunci 100%</span>
                  </div>
                  <video
                    controls
                    controlsList="nodownload"
                    src={currentQuestion.media.url}
                    onLoadedMetadata={enforceMaxVolume}
                    onPlay={enforceMaxVolume}
                    onVolumeChange={enforceMaxVolume}
                    className="w-full max-h-80 rounded-lg border border-slate-200 bg-black"
                  />
                </div>
              )}
            </div>
          )}

          <div className="text-base text-slate-900 leading-relaxed whitespace-pre-line">
            {currentQuestion.prompt}
          </div>

          {/* 1. Pilihan Ganda */}
          {currentQuestion.type === 'pg' && currentQuestion.options && (
            <div className="space-y-3" role="radiogroup" aria-label="Pilihan jawaban">
              {currentQuestion.options.map((opt, idx) => {
                const selected = answers[currentQuestion.id] === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => handleSelectSingle(currentQuestion.id, idx)}
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
          )}

          {/* 2. Pilihan Ganda Kompleks */}
          {currentQuestion.type === 'pg_kompleks' && currentQuestion.options && (
            <div className="space-y-3" role="group" aria-label="Pilihan jawaban ganda kompleks">
              <p className="text-xs font-medium text-teal-800 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
                Pilih lebih dari satu jawaban yang benar (centang semua pernyataan/opsi yang tepat).
              </p>
              {currentQuestion.options.map((opt, idx) => {
                const selectedList = Array.isArray(answers[currentQuestion.id])
                  ? (answers[currentQuestion.id] as number[])
                  : [];
                const checked = selectedList.includes(idx);
                return (
                  <button
                    key={idx}
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    onClick={() =>
                      handleToggleComplexOption(currentQuestion.id, idx)
                    }
                    className={`w-full text-left p-4 rounded-xl border transition-colors flex items-start gap-3.5 cursor-pointer ${
                      checked
                        ? 'bg-teal-50/70 border-teal-600 text-slate-900'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className={`w-6 h-6 rounded-md font-mono text-xs font-bold flex items-center justify-center shrink-0 border mt-0.5 ${
                        checked
                          ? 'bg-teal-700 border-teal-700 text-white'
                          : 'bg-white border-slate-300 text-slate-400'
                      }`}
                    >
                      {checked ? <Check className="w-3.5 h-3.5" /> : OPTION_LETTERS[idx] ?? idx + 1}
                    </span>
                    <span className="text-sm leading-relaxed pt-0.5">{opt}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* 3. Benar / Salah */}
          {currentQuestion.type === 'benar_salah' && currentQuestion.statements && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-slate-600">
                Tentukan apakah masing-masing pernyataan di bawah ini Benar atau Salah:
              </p>
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-200">
                {currentQuestion.statements.map((st, idx) => {
                  const ansObj = answers[currentQuestion.id];
                  const val =
                    ansObj && typeof ansObj === 'object' && !Array.isArray(ansObj)
                      ? (ansObj as Record<number, boolean>)[idx]
                      : undefined;
                  return (
                    <div
                      key={idx}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <p className="text-sm text-slate-800 leading-relaxed">
                        <span className="font-mono font-semibold text-slate-500 mr-2">
                          {idx + 1}.
                        </span>
                        {st.text}
                      </p>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          aria-pressed={val === true}
                          onClick={() =>
                            handleSelectTrueFalse(currentQuestion.id, idx, true)
                          }
                          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer ${
                            val === true
                              ? 'bg-emerald-700 border-emerald-700 text-white'
                              : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          Benar
                        </button>
                        <button
                          type="button"
                          aria-pressed={val === false}
                          onClick={() =>
                            handleSelectTrueFalse(currentQuestion.id, idx, false)
                          }
                          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer ${
                            val === false
                              ? 'bg-red-700 border-red-700 text-white'
                              : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          Salah
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. Menjodohkan */}
          {currentQuestion.type === 'menjodohkan' && currentQuestion.matchingPairs && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-slate-600">
                Pasangkan setiap premis di sebelah kiri dengan jawaban yang sesuai di sebelah kanan:
              </p>
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-200">
                {currentQuestion.matchingPairs.map((pair, idx) => {
                  const ansObj = answers[currentQuestion.id];
                  const selectedRight =
                    ansObj && typeof ansObj === 'object' && !Array.isArray(ansObj)
                      ? (ansObj as Record<number, string>)[idx] ?? ''
                      : '';
                  return (
                    <div
                      key={idx}
                      className="p-4 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center"
                    >
                      <div className="sm:col-span-6 text-sm font-medium text-slate-900">
                        <span className="font-mono text-slate-500 mr-2">
                          {idx + 1}.
                        </span>
                        {pair.left}
                      </div>
                      <div className="sm:col-span-6">
                        <select
                          aria-label={`Pasangan untuk ${pair.left}`}
                          value={selectedRight}
                          onChange={(e) =>
                            handleSelectMatching(
                              currentQuestion.id,
                              idx,
                              e.target.value
                            )
                          }
                          className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                        >
                          <option value="">-- Pilih Pasangan --</option>
                          {matchingRightOptions.map((opt, optIdx) => (
                            <option key={optIdx} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 5. Esai */}
          {currentQuestion.type === 'esai' && (
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
                className="w-full p-4 text-sm bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 select-text"
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
                <span>Selesai &amp; Kumpulkan</span>
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
              const isAnswered = isQuestionAnswered(q, answers[q.id]);
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
              onClick={() => {
                exitExamFullscreen();
                onExitWithoutSubmit();
              }}
              className="w-full py-2 px-3 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              Simpan Sementara &amp; Kembali ke Beranda
            </button>
          </div>
        </aside>
      </main>

      {/* Temporary Tab-Switch / Fullscreen Lock Screen Modal */}
      {isLocked && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="tab-lock-title"
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleUnlockSubmit}
            className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5 text-red-700" />
              </div>
              <div>
                <p className="text-xs font-semibold text-red-700 font-mono tabular-nums">
                  Peringatan Pelanggaran ({tabSwitches} dari {maxWarnings})
                </p>
                <h2
                  id="tab-lock-title"
                  className="font-display text-lg font-bold text-slate-900 mt-0.5"
                >
                  Layar Ujian Terkunci Sementara
                </h2>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-950 leading-relaxed space-y-1">
              <p>{lockReason}</p>
              <p className="font-semibold">
                {remainingTolerance === 1
                  ? `Peringatan terakhir! Jika pelanggaran terjadi 1 kali lagi (ke-${maxWarnings}), ujian dinyatakan selesai dan jawaban dikirim otomatis.`
                  : `Jika pelanggaran ini terjadi sebanyak ${maxWarnings} kali, ujian akan dinyatakan selesai secara otomatis.`}
              </p>
            </div>

            <div>
              <label
                htmlFor="unlock-exam-code"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Masukkan Kembali Kode Ujian untuk Membuka Kunci
              </label>
              <input
                id="unlock-exam-code"
                type="text"
                autoFocus
                value={unlockCodeInput}
                onChange={(e) => setUnlockCodeInput(e.target.value.toUpperCase())}
                placeholder="Masukkan kembali kode ujian Anda"
                className="w-full px-3.5 py-2.5 text-sm font-mono uppercase tracking-wider placeholder:normal-case placeholder:tracking-normal bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
              />
            </div>

            {unlockError && (
              <p role="alert" className="text-xs font-medium text-red-700">
                {unlockError}
              </p>
            )}

            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Buka Kunci, Layar Penuh &amp; Lanjutkan Ujian
            </button>
          </form>
        </div>
      )}

      {/* Final Submit Confirmation Modal */}
      {showConfirmModal && !isLocked && (
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
