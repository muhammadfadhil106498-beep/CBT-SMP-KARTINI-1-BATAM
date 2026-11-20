import React, { useMemo, useState } from 'react';
import {
  BrainCircuit,
  CheckCircle2,
  FilePlus2,
  Image as ImageIcon,
  Layers,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type {
  ActivityLog,
  DifficultyLevel,
  Exam,
  ExamSubmission,
  MatchingPair,
  Question,
  QuestionMedia,
  QuestionType,
  TrueFalseStatement,
  User,
} from '../types/exam';
import {
  computeExamProgressStats,
  filterExamsForTeacher,
  filterLogsForTeacher,
  filterQuestionsForTeacher,
  filterSubmissionsForTeacher,
  gradeSubmission,
  isClassEligibleForExam,
  isTeacherSubjectMatch,
  PortalTab,
  QUESTION_TYPE_LABELS,
} from '../utils/examEngine';
import {
  BackendCapabilities,
  GeneratedQuestionDraft,
  requestAiExamAnalysis,
  requestAiQuestionGeneration,
} from '../services/storage';
import {
  inferMediaTypeFromUrl,
  readQuestionMediaFile,
} from '../utils/mediaUpload';
import { GradeAndLogReportPanel } from './GradeAndLogReportPanel';

interface TeacherPortalProps {
  user: User;
  activeTab: PortalTab;
  users: User[];
  questions: Question[];
  exams: Exam[];
  submissions: ExamSubmission[];
  activityLogs: ActivityLog[];
  capabilities: BackendCapabilities;
  onAddQuestion: (q: Question) => void;
  onDeleteQuestion: (questionId: string) => void;
  onSaveExam: (exam: Exam) => void;
  onUpdateSubmission: (sub: ExamSubmission) => void;
}

export const TeacherPortal: React.FC<TeacherPortalProps> = ({
  user,
  activeTab,
  users,
  questions,
  exams,
  submissions,
  activityLogs,
  capabilities,
  onAddQuestion,
  onDeleteQuestion,
  onSaveExam,
  onUpdateSubmission,
}) => {
  const teacherSubject = (user.mapel ?? '').trim();

  const scopedQuestions = useMemo(
    () => filterQuestionsForTeacher(questions, user),
    [questions, user]
  );

  const scopedExams = useMemo(
    () => filterExamsForTeacher(exams, user),
    [exams, user]
  );

  const scopedSubmissions = useMemo(
    () => filterSubmissionsForTeacher(submissions, scopedExams),
    [submissions, scopedExams]
  );

  const scopedLogs = useMemo(
    () => filterLogsForTeacher(activityLogs, scopedExams, user),
    [activityLogs, scopedExams, user]
  );

  const [selectedExamId, setSelectedExamId] = useState<string>(
    scopedExams[0]?.id ?? ''
  );
  const [reportExamId, setReportExamId] = useState<string>('semua');
  const [searchStudent, setSearchStudent] = useState('');
  const [progressFilter, setProgressFilter] = useState<
    'semua' | 'sedang_mengerjakan' | 'selesai'
  >('semua');

  // Question form state (5 types + media) - subject locked to teacher's mapel
  const qSubject = teacherSubject || 'Umum';
  const [qGrade, setQGrade] = useState<'7' | '8' | '9'>('9');
  const [qType, setQType] = useState<QuestionType>('pg');
  const [qDifficulty, setQDifficulty] = useState<DifficultyLevel>('Sedang');
  const [qPoints, setQPoints] = useState(20);
  const [qPrompt, setQPrompt] = useState('');
  const [qOptions, setQOptions] = useState(['', '', '', '']);
  const [qCorrectIdx, setQCorrectIdx] = useState(0);
  const [qCorrectIndices, setQCorrectIndices] = useState<number[]>([0, 1]);
  const [qStatements, setQStatements] = useState<TrueFalseStatement[]>([
    { text: '', isTrue: true },
    { text: '', isTrue: false },
  ]);
  const [qMatchingPairs, setQMatchingPairs] = useState<MatchingPair[]>([
    { left: '', right: '' },
    { left: '', right: '' },
  ]);
  const [qRubric, setQRubric] = useState('');
  const [qMedia, setQMedia] = useState<QuestionMedia | undefined>(undefined);
  const [qMediaUrlInput, setQMediaUrlInput] = useState('');
  const [qMediaError, setQMediaError] = useState<string | null>(null);
  const [qFormMsg, setQFormMsg] = useState<string | null>(null);

  // Exam builder modal - subject locked to teacher's mapel
  const [showExamModal, setShowExamModal] = useState(false);
  const [newExTitle, setNewExTitle] = useState('');
  const newExSubject = teacherSubject || 'Umum';
  const [newExClass, setNewExClass] = useState('Semua Kelas 9');
  const [newExDuration, setNewExDuration] = useState(45);
  const [newExToken, setNewExToken] = useState('KRT9X1');
  const [newExRequireToken, setNewExRequireToken] = useState(true);
  const [newExSelectedQs, setNewExSelectedQs] = useState<string[]>([]);

  // Essay grading modal
  const [gradingSubId, setGradingSubId] = useState<string | null>(null);
  const [draftEssayScores, setDraftEssayScores] = useState<Record<string, number>>({});
  const [draftEssayFeedback, setDraftEssayFeedback] = useState<Record<string, string>>({});

  // AI Deep Thinking Assistant state - subject locked to teacher's mapel
  const [aiTopic, setAiTopic] = useState('Konsep Inti & Aplikasi Nyata');
  const aiSubject = teacherSubject || 'Umum';
  const [aiGrade, setAiGrade] = useState<'7' | '8' | '9'>('9');
  const [aiQType, setAiQType] = useState<QuestionType>('pg');
  const [aiCount, setAiCount] = useState(2);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiDrafts, setAiDrafts] = useState<GeneratedQuestionDraft[]>([]);
  const [aiAnalysisPrompt, setAiAnalysisPrompt] = useState(
    'Analisis tingkat kesulitan butir soal, performa siswa kelas 9, dan strategi remedial efektif untuk topik yang nilainya masih di bawah KKM 75.'
  );
  const [aiAnalysisResult, setAiAnalysisResult] = useState<string | null>(null);

  const selectedExam = useMemo(
    () => scopedExams.find((e) => e.id === selectedExamId) ?? scopedExams[0],
    [scopedExams, selectedExamId]
  );

  const students = useMemo(
    () => users.filter((u) => u.role === 'siswa' && u.active),
    [users]
  );

  const eligibleStudentsForSelected = useMemo(() => {
    if (!selectedExam) return [];
    return students.filter((s) =>
      isClassEligibleForExam(s.kelas, selectedExam.targetClass)
    );
  }, [students, selectedExam]);

  const selectedExamSubs = useMemo(() => {
    if (!selectedExam) return [];
    return scopedSubmissions.filter((s) => s.examId === selectedExam.id);
  }, [scopedSubmissions, selectedExam]);

  const progressStats = useMemo(() => {
    if (!selectedExam) {
      return {
        eligibleCount: 0,
        inProgressCount: 0,
        completedCount: 0,
        notStartedCount: 0,
        averageScore: 0,
      };
    }
    return computeExamProgressStats(
      selectedExam,
      scopedSubmissions,
      eligibleStudentsForSelected.length
    );
  }, [selectedExam, scopedSubmissions, eligibleStudentsForSelected.length]);

  const filteredSubs = useMemo(() => {
    const q = searchStudent.trim().toLowerCase();
    return selectedExamSubs.filter((s) => {
      const matchStatus =
        progressFilter === 'semua' ? true : s.status === progressFilter;
      const matchQuery =
        !q ||
        s.studentName.toLowerCase().includes(q) ||
        s.studentNis.toLowerCase().includes(q) ||
        s.studentClass.toLowerCase().includes(q);
      return matchStatus && matchQuery;
    });
  }, [selectedExamSubs, searchStudent, progressFilter]);

  const handleQuestionMediaFile = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setQMediaError(null);
    try {
      const processed = await readQuestionMediaFile(file);
      setQMedia({
        type: processed.type,
        url: processed.url,
        name: processed.name,
      });
      setQMediaUrlInput('');
    } catch (err) {
      setQMediaError(
        err instanceof Error ? err.message : 'Gagal memproses file media.'
      );
    }
  };

  const handleApplyMediaUrl = () => {
    const clean = qMediaUrlInput.trim();
    if (!clean) return;
    setQMediaError(null);
    setQMedia({
      type: inferMediaTypeFromUrl(clean),
      url: clean,
      name: 'Media URL',
    });
  };

  const handleCreateQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!qPrompt.trim()) {
      setQFormMsg('Teks pertanyaan wajib diisi.');
      return;
    }
    if (qType === 'pg' && qOptions.some((o) => !o.trim())) {
      setQFormMsg('Keempat opsi pilihan ganda wajib diisi lengkap.');
      return;
    }
    if (qType === 'pg_kompleks') {
      if (qOptions.some((o) => !o.trim())) {
        setQFormMsg('Keempat opsi pilihan ganda kompleks wajib diisi lengkap.');
        return;
      }
      if (qCorrectIndices.length === 0) {
        setQFormMsg('Pilih minimal 1 kunci jawaban benar untuk PG Kompleks.');
        return;
      }
    }
    if (
      qType === 'benar_salah' &&
      (qStatements.length === 0 || qStatements.some((st) => !st.text.trim()))
    ) {
      setQFormMsg('Seluruh pernyataan Benar / Salah wajib diisi teksnya.');
      return;
    }
    if (
      qType === 'menjodohkan' &&
      (qMatchingPairs.length === 0 ||
        qMatchingPairs.some((p) => !p.left.trim() || !p.right.trim()))
    ) {
      setQFormMsg('Seluruh pasangan premis & jawaban Menjodohkan wajib diisi lengkap.');
      return;
    }

    const newQ: Question = {
      id: `q-${Date.now()}`,
      subject: qSubject,
      gradeLevel: qGrade,
      type: qType,
      prompt: qPrompt.trim(),
      media: qMedia,
      options:
        qType === 'pg' || qType === 'pg_kompleks'
          ? qOptions.map((o) => o.trim())
          : undefined,
      correctOptionIndex: qType === 'pg' ? qCorrectIdx : undefined,
      correctOptionIndices:
        qType === 'pg_kompleks' ? [...qCorrectIndices].sort((a, b) => a - b) : undefined,
      statements:
        qType === 'benar_salah'
          ? qStatements.map((s) => ({ text: s.text.trim(), isTrue: s.isTrue }))
          : undefined,
      matchingPairs:
        qType === 'menjodohkan'
          ? qMatchingPairs.map((p) => ({
              left: p.left.trim(),
              right: p.right.trim(),
            }))
          : undefined,
      rubric: qRubric.trim() || undefined,
      points: Math.max(1, Number(qPoints) || 10),
      difficulty: qDifficulty,
      createdBy: user.id,
      createdAt: new Date().toISOString(),
    };

    onAddQuestion(newQ);
    setQPrompt('');
    setQOptions(['', '', '', '']);
    setQCorrectIndices([0, 1]);
    setQStatements([
      { text: '', isTrue: true },
      { text: '', isTrue: false },
    ]);
    setQMatchingPairs([
      { left: '', right: '' },
      { left: '', right: '' },
    ]);
    setQRubric('');
    setQMedia(undefined);
    setQMediaUrlInput('');
    setQFormMsg('Butir soal berhasil disimpan ke Bank Soal.');
  };

  const handleCreateExam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExTitle.trim() || newExSelectedQs.length === 0) return;

    const now = new Date();
    const later = new Date(now.getTime() + newExDuration * 60000);
    const created: Exam = {
      id: `ex-${Date.now()}`,
      title: newExTitle.trim(),
      subject: newExSubject,
      targetClass: newExClass,
      gradeLevel: newExClass.includes('7')
        ? '7'
        : newExClass.includes('8')
        ? '8'
        : '9',
      teacherId: user.id,
      teacherName: user.name,
      durationMinutes: Math.max(5, newExDuration),
      startTime: now.toISOString().slice(0, 16),
      endTime: later.toISOString().slice(0, 16),
      token: newExToken.trim().toUpperCase() || 'KRT001',
      requireToken: newExRequireToken,
      shuffleQuestions: false,
      showResultToStudent: true,
      status: 'berlangsung',
      questionIds: newExSelectedQs,
      room: 'Lab Komputer 1',
    };

    onSaveExam(created);
    setSelectedExamId(created.id);
    setShowExamModal(false);
    setNewExTitle('');
    setNewExSelectedQs([]);
  };

  const openEssayGrading = (sub: ExamSubmission) => {
    setGradingSubId(sub.id);
    setDraftEssayScores({ ...sub.essayScores });
    setDraftEssayFeedback({ ...sub.essayFeedback });
  };

  const saveEssayGrading = () => {
    if (!gradingSubId || !selectedExam) return;
    if (!isTeacherSubjectMatch(user.mapel, selectedExam.subject)) return;
    const targetSub = scopedSubmissions.find((s) => s.id === gradingSubId);
    if (!targetSub) return;

    const examQuestions = scopedQuestions.filter((q) =>
      selectedExam.questionIds.includes(q.id)
    );
    const calc = gradeSubmission(examQuestions, targetSub.answers, draftEssayScores);
    onUpdateSubmission({
      ...targetSub,
      essayScores: draftEssayScores,
      essayFeedback: draftEssayFeedback,
      autoScore: calc.autoScore,
      essayScoreTotal: calc.essayScoreTotal,
      finalScore: calc.finalScore,
    });
    setGradingSubId(null);
  };

  const handleGenerateAiQuestions = async (e: React.FormEvent) => {
    e.preventDefault();
    setAiLoading(true);
    setAiError(null);
    const res = await requestAiQuestionGeneration({
      subject: aiSubject,
      gradeLevel: aiGrade,
      topic: aiTopic,
      questionType: aiQType,
      count: aiCount,
    });
    setAiLoading(false);
    if (res.error) {
      setAiError(res.error);
      return;
    }
    setAiDrafts(res.questions ?? []);
  };

  const handleRunAiAnalysis = async () => {
    setAiLoading(true);
    setAiError(null);
    const summaryContext = selectedExam
      ? `Ujian: ${selectedExam.title} (${selectedExam.subject}, ${selectedExam.targetClass}). Selesai: ${progressStats.completedCount}, Rata-rata nilai: ${progressStats.averageScore}.`
      : '';
    const res = await requestAiExamAnalysis(
      `${summaryContext}\n\nPermintaan Guru (${user.name}): ${aiAnalysisPrompt}`
    );
    setAiLoading(false);
    if (res.error) {
      setAiError(res.error);
      return;
    }
    setAiAnalysisResult(res.analysis ?? '');
  };

  const handleAdoptDraft = (draft: GeneratedQuestionDraft, idx: number) => {
    const newQ: Question = {
      id: `q-ai-${Date.now()}-${idx}`,
      subject: aiSubject,
      gradeLevel: aiGrade,
      type: draft.options && draft.options.length > 0 ? 'pg' : 'esai',
      prompt: draft.prompt,
      options:
        draft.options && draft.options.length > 0 ? draft.options : undefined,
      correctOptionIndex:
        draft.options && draft.options.length > 0
          ? draft.correctOptionIndex ?? 0
          : undefined,
      rubric: draft.rubric,
      points: draft.points || 20,
      difficulty:
        draft.difficulty === 'Mudah' || draft.difficulty === 'Sulit'
          ? draft.difficulty
          : 'Sedang',
      createdBy: user.id,
      createdAt: new Date().toISOString(),
    };
    onAddQuestion(newQ);
    setAiDrafts((prev) => prev.filter((_, i) => i !== idx));
  };

  // TAB 4: AI Deep Thinking Assistant (gemini-4-carbon, ThinkingLevel.HIGH)
  if (activeTab === 'guru-ai') {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-teal-700 mb-1">
              Penalaran Mendalam · Model gemini-4-carbon (ThinkingLevel.HIGH)
            </p>
            <h1 className="font-display text-2xl font-bold text-slate-900">
              Asisten Soal & Evaluasi Guru
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Susun soal HOTS Kurikulum Merdeka atau lakukan analisis pedagogis mendalam atas hasil ujian siswa.
            </p>
          </div>
          <div className="text-xs text-slate-600 bg-white border border-slate-200 rounded-lg px-3.5 py-2">
            Status Layanan:{' '}
            <strong className="text-slate-900">
              {capabilities.mode === 'static'
                ? 'Mode Statis GitHub (Butuh Server Node untuk AI)'
                : capabilities.aiAvailable
                ? 'Server AI Siap'
                : 'GEMINI_API_KEY Belum Diatur'}
            </strong>
          </div>
        </div>

        {aiError && (
          <div
            role="alert"
            className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900"
          >
            {aiError}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Generator Soal HOTS */}
          <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-5 h-5 text-teal-700" />
              <h2 className="font-display text-lg font-bold text-slate-900">
                Generator Soal HOTS Otomatis
              </h2>
            </div>

            <form onSubmit={handleGenerateAiQuestions} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="ai-subject"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Mata Pelajaran (Terkunci Mapel Guru)
                  </label>
                  <input
                    id="ai-subject"
                    type="text"
                    readOnly
                    value={aiSubject}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-700"
                  />
                </div>
                <div>
                  <label
                    htmlFor="ai-grade"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Tingkat Kelas
                  </label>
                  <select
                    id="ai-grade"
                    value={aiGrade}
                    onChange={(e) =>
                      setAiGrade(e.target.value as '7' | '8' | '9')
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="7">Kelas 7</option>
                    <option value="8">Kelas 8</option>
                    <option value="9">Kelas 9</option>
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="ai-topic"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Topik / Kompetensi Dasar
                </label>
                <input
                  id="ai-topic"
                  type="text"
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="ai-qtype"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Jenis Soal
                  </label>
                  <select
                    id="ai-qtype"
                    value={aiQType}
                    onChange={(e) =>
                      setAiQType(e.target.value as QuestionType)
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="pg">Pilihan Ganda</option>
                    <option value="esai">Esai / Uraian</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="ai-count"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Jumlah Soal (1–5)
                  </label>
                  <input
                    id="ai-count"
                    type="number"
                    min={1}
                    max={5}
                    value={aiCount}
                    onChange={(e) => setAiCount(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={aiLoading}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-semibold rounded-lg inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                {aiLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <BrainCircuit className="w-4 h-4" />
                )}
                <span>Susun Soal dengan Penalaran Tinggi</span>
              </button>
            </form>

            {aiDrafts.length > 0 && (
              <div className="pt-4 border-t border-slate-200 space-y-4">
                <h3 className="text-sm font-bold text-slate-900">
                  Draf Soal Dihasilkan ({aiDrafts.length})
                </h3>
                {aiDrafts.map((draft, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-lg border border-slate-200 bg-slate-50 space-y-2.5"
                  >
                    <p className="text-xs text-slate-500">
                      {draft.difficulty} · {draft.points} poin
                    </p>
                    <p className="text-sm font-medium text-slate-900">
                      {draft.prompt}
                    </p>
                    {draft.options && draft.options.length > 0 && (
                      <ul className="text-xs text-slate-700 space-y-1 pl-4 list-disc">
                        {draft.options.map((o, oi) => (
                          <li
                            key={oi}
                            className={
                              oi === draft.correctOptionIndex
                                ? 'font-semibold text-emerald-700'
                                : ''
                            }
                          >
                            {o}
                          </li>
                        ))}
                      </ul>
                    )}
                    {draft.rubric && (
                      <p className="text-xs text-slate-600">
                        Pembahasan/Rubrik: {draft.rubric}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => handleAdoptDraft(draft, idx)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-md cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Simpan ke Bank Soal</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Analisis Pedagogis */}
          <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div className="flex items-center gap-2.5">
              <BrainCircuit className="w-5 h-5 text-slate-800" />
              <h2 className="font-display text-lg font-bold text-slate-900">
                Analisis Pedagogis & Remedial
              </h2>
            </div>

            <div className="space-y-3">
              <label
                htmlFor="ai-analysis-prompt"
                className="block text-xs font-semibold text-slate-700"
              >
                Konteks Evaluasi untuk Ujian:{' '}
                <span className="text-teal-700">
                  {selectedExam?.title ?? 'Semua Ujian'}
                </span>
              </label>
              <textarea
                id="ai-analysis-prompt"
                rows={4}
                value={aiAnalysisPrompt}
                onChange={(e) => setAiAnalysisPrompt(e.target.value)}
                className="w-full p-3 text-sm border border-slate-300 rounded-lg"
              />
              <button
                type="button"
                disabled={aiLoading}
                onClick={handleRunAiAnalysis}
                className="py-2.5 px-4 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-sm font-semibold rounded-lg inline-flex items-center gap-2 cursor-pointer"
              >
                {aiLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <BrainCircuit className="w-4 h-4" />
                )}
                <span>Jalankan Analisis Mendalam</span>
              </button>
            </div>

            {aiAnalysisResult && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 leading-relaxed whitespace-pre-line">
                {aiAnalysisResult}
              </div>
            )}
          </section>
        </div>
      </div>
    );
  }

  // TAB 2: Bank Soal & Pembuat Ujian
  if (activeTab === 'guru-soal') {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-teal-700 mb-1">
              Akses Khusus Mapel: {teacherSubject || 'Belum Diatur'}
            </p>
            <h1 className="font-display text-2xl font-bold text-slate-900">
              Bank Soal &amp; Paket Ujian
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Menampilkan dan mengelola soal khusus mata pelajaran <strong>{teacherSubject || 'Anda'}</strong> dalam 5 tipe soal beserta lampiran media.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowExamModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Layers className="w-4 h-4" />
            <span>Buat Paket Ujian Baru</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Create Question Form */}
          <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <FilePlus2 className="w-5 h-5 text-teal-700" />
              <h2 className="font-display text-lg font-bold text-slate-900">
                Tambah Butir Soal
              </h2>
            </div>

            <form onSubmit={handleCreateQuestion} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="q-subject"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Mata Pelajaran
                  </label>
                  <input
                    id="q-subject"
                    type="text"
                    readOnly
                    value={qSubject}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-700 font-medium"
                  />
                </div>
                <div>
                  <label
                    htmlFor="q-grade"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Kelas
                  </label>
                  <select
                    id="q-grade"
                    value={qGrade}
                    onChange={(e) =>
                      setQGrade(e.target.value as '7' | '8' | '9')
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="7">Kelas 7</option>
                    <option value="8">Kelas 8</option>
                    <option value="9">Kelas 9</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label
                    htmlFor="q-type"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Tipe Soal
                  </label>
                  <select
                    id="q-type"
                    value={qType}
                    onChange={(e) => setQType(e.target.value as QuestionType)}
                    className="w-full px-2.5 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="pg">Pilihan Ganda</option>
                    <option value="pg_kompleks">PG Kompleks</option>
                    <option value="benar_salah">Benar / Salah</option>
                    <option value="menjodohkan">Menjodohkan</option>
                    <option value="esai">Esai</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="q-diff"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Kesulitan
                  </label>
                  <select
                    id="q-diff"
                    value={qDifficulty}
                    onChange={(e) =>
                      setQDifficulty(e.target.value as DifficultyLevel)
                    }
                    className="w-full px-2.5 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Mudah">Mudah</option>
                    <option value="Sedang">Sedang</option>
                    <option value="Sulit">Sulit</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="q-points"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Bobot Poin
                  </label>
                  <input
                    id="q-points"
                    type="number"
                    min={1}
                    max={100}
                    value={qPoints}
                    onChange={(e) => setQPoints(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="q-prompt"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Pertanyaan
                </label>
                <textarea
                  id="q-prompt"
                  rows={3}
                  value={qPrompt}
                  onChange={(e) => setQPrompt(e.target.value)}
                  placeholder="Tuliskan teks soal ujian..."
                  className="w-full p-3 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              {/* Upload Media Soal */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                    <ImageIcon className="w-3.5 h-3.5 text-teal-700" />
                    <span>Upload Media Soal (Opsional: Gambar / Audio / Video)</span>
                  </span>
                  {qMedia && (
                    <button
                      type="button"
                      onClick={() => setQMedia(undefined)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-red-700 hover:underline cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Hapus Media</span>
                    </button>
                  )}
                </div>

                <input
                  id="q-media-file"
                  aria-label="Unggah file media soal"
                  type="file"
                  accept="image/*,audio/*,video/*"
                  onChange={handleQuestionMediaFile}
                  className="block w-full text-xs text-slate-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-slate-300 file:text-xs file:font-semibold file:bg-white file:text-slate-800 hover:file:bg-slate-100 cursor-pointer"
                />

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={qMediaUrlInput}
                    onChange={(e) => setQMediaUrlInput(e.target.value)}
                    placeholder="Atau tempel URL gambar/audio/video..."
                    className="flex-1 px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={handleApplyMediaUrl}
                    className="px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-slate-700 cursor-pointer"
                  >
                    Pakai URL
                  </button>
                </div>

                {qMediaError && (
                  <p role="alert" className="text-xs font-medium text-red-700">
                    {qMediaError}
                  </p>
                )}

                {qMedia && (
                  <div className="pt-1">
                    {qMedia.type === 'image' && (
                      <img
                        src={qMedia.url}
                        alt={qMedia.name || 'Pratinjau media soal'}
                        className="max-h-36 rounded-lg border border-slate-200 object-contain bg-white"
                      />
                    )}
                    {qMedia.type === 'audio' && (
                      <audio controls src={qMedia.url} className="w-full" />
                    )}
                    {qMedia.type === 'video' && (
                      <video
                        controls
                        src={qMedia.url}
                        className="w-full max-h-40 rounded-lg border border-slate-200 bg-black"
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Editor for each of 5 question types */}
              {qType === 'pg' && (
                <div className="space-y-2.5">
                  <p className="text-xs font-semibold text-slate-700">
                    Pilihan Jawaban &amp; Kunci Benar (1 Opsi)
                  </p>
                  {qOptions.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="correct-option"
                        aria-label={`Tandai opsi ${String.fromCharCode(65 + idx)} benar`}
                        checked={qCorrectIdx === idx}
                        onChange={() => setQCorrectIdx(idx)}
                        className="accent-teal-700"
                      />
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => {
                          const next = [...qOptions];
                          next[idx] = e.target.value;
                          setQOptions(next);
                        }}
                        placeholder={`Opsi ${String.fromCharCode(65 + idx)}`}
                        className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
                      />
                    </div>
                  ))}
                </div>
              )}

              {qType === 'pg_kompleks' && (
                <div className="space-y-2.5">
                  <p className="text-xs font-semibold text-slate-700">
                    Pilihan Jawaban &amp; Kunci Benar (Centang Bisa Lebih dari 1)
                  </p>
                  {qOptions.map((opt, idx) => {
                    const isChecked = qCorrectIndices.includes(idx);
                    return (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          aria-label={`Tandai opsi kompleks ${String.fromCharCode(65 + idx)} benar`}
                          checked={isChecked}
                          onChange={() =>
                            setQCorrectIndices((prev) =>
                              isChecked
                                ? prev.filter((i) => i !== idx)
                                : [...prev, idx]
                            )
                          }
                          className="accent-teal-700"
                        />
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => {
                            const next = [...qOptions];
                            next[idx] = e.target.value;
                            setQOptions(next);
                          }}
                          placeholder={`Opsi ${String.fromCharCode(65 + idx)}`}
                          className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {qType === 'benar_salah' && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-700">
                      Daftar Pernyataan Benar / Salah
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        setQStatements((prev) => [
                          ...prev,
                          { text: '', isTrue: true },
                        ])
                      }
                      className="text-xs font-semibold text-teal-700 hover:underline cursor-pointer"
                    >
                      + Tambah Pernyataan
                    </button>
                  </div>
                  {qStatements.map((st, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200"
                    >
                      <input
                        type="text"
                        value={st.text}
                        onChange={(e) => {
                          const next = [...qStatements];
                          next[idx] = { ...next[idx], text: e.target.value };
                          setQStatements(next);
                        }}
                        placeholder={`Pernyataan ${idx + 1}`}
                        className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                      <select
                        aria-label={`Kunci pernyataan ${idx + 1}`}
                        value={st.isTrue ? 'benar' : 'salah'}
                        onChange={(e) => {
                          const next = [...qStatements];
                          next[idx] = {
                            ...next[idx],
                            isTrue: e.target.value === 'benar',
                          };
                          setQStatements(next);
                        }}
                        className="px-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-semibold"
                      >
                        <option value="benar">Benar</option>
                        <option value="salah">Salah</option>
                      </select>
                      {qStatements.length > 1 && (
                        <button
                          type="button"
                          aria-label={`Hapus pernyataan ${idx + 1}`}
                          onClick={() =>
                            setQStatements((prev) =>
                              prev.filter((_, i) => i !== idx)
                            )
                          }
                          className="p-1 text-slate-400 hover:text-red-700 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {qType === 'menjodohkan' && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-700">
                      Pasangan Premis &amp; Jawaban Menjodohkan
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        setQMatchingPairs((prev) => [
                          ...prev,
                          { left: '', right: '' },
                        ])
                      }
                      className="text-xs font-semibold text-teal-700 hover:underline cursor-pointer"
                    >
                      + Tambah Pasangan
                    </button>
                  </div>
                  {qMatchingPairs.map((pair, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200"
                    >
                      <input
                        type="text"
                        value={pair.left}
                        onChange={(e) => {
                          const next = [...qMatchingPairs];
                          next[idx] = { ...next[idx], left: e.target.value };
                          setQMatchingPairs(next);
                        }}
                        placeholder={`Premis ${idx + 1}`}
                        className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                      <span className="text-xs text-slate-400">→</span>
                      <input
                        type="text"
                        value={pair.right}
                        onChange={(e) => {
                          const next = [...qMatchingPairs];
                          next[idx] = { ...next[idx], right: e.target.value };
                          setQMatchingPairs(next);
                        }}
                        placeholder={`Pasangan ${idx + 1}`}
                        className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                      {qMatchingPairs.length > 1 && (
                        <button
                          type="button"
                          aria-label={`Hapus pasangan ${idx + 1}`}
                          onClick={() =>
                            setQMatchingPairs((prev) =>
                              prev.filter((_, i) => i !== idx)
                            )
                          }
                          className="p-1 text-slate-400 hover:text-red-700 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {qType === 'esai' && (
                <div>
                  <label
                    htmlFor="q-rubric"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Rubrik / Pedoman Penilaian Esai
                  </label>
                  <textarea
                    id="q-rubric"
                    rows={2}
                    value={qRubric}
                    onChange={(e) => setQRubric(e.target.value)}
                    placeholder="Kriteria poin untuk jawaban siswa..."
                    className="w-full p-2.5 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              )}

              {qFormMsg && (
                <p className="text-xs font-medium text-teal-800 bg-teal-50 border border-teal-200 rounded-lg p-2.5">
                  {qFormMsg}
                </p>
              )}

              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold rounded-lg cursor-pointer"
              >
                Simpan Soal ke Bank
              </button>
            </form>
          </section>

          {/* Question Bank List */}
          <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-2">
              <h2 className="font-display text-base font-bold text-slate-900">
                Daftar Bank Soal {teacherSubject ? `· ${teacherSubject}` : ''} ({scopedQuestions.length})
              </h2>
              <span className="text-xs text-slate-500">
                Khusus mapel diampu
              </span>
            </div>

            {scopedQuestions.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-600">
                Belum ada butir soal untuk mata pelajaran {teacherSubject || 'Anda'}. Gunakan formulir di sebelah kiri untuk menambahkan soal baru.
              </div>
            ) : (
            <div className="divide-y divide-slate-200">
              {scopedQuestions.map((q, index) => (
                <div key={q.id} className="p-5 flex items-start justify-between gap-4">
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="text-xs text-slate-500 flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-slate-800">
                        #{index + 1} · {q.subject}
                      </span>
                      <span>· Kelas {q.gradeLevel}</span>
                      <span>·</span>
                      <span className="font-semibold text-teal-700">
                        {QUESTION_TYPE_LABELS[q.type]}
                      </span>
                      <span>·</span>
                      <span className="font-mono tabular-nums">{q.points} poin</span>
                      <span>· {q.difficulty}</span>
                      {q.media && (
                        <span className="font-semibold text-slate-700">
                          · Media: {q.media.type.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-900 leading-relaxed">
                      {q.prompt}
                    </p>
                    {q.media?.type === 'image' && (
                      <img
                        src={q.media.url}
                        alt={q.media.name || 'Gambar soal'}
                        className="max-h-24 rounded-lg border border-slate-200 object-contain bg-slate-50"
                      />
                    )}
                    {q.type === 'pg' && q.options && (
                      <p className="text-xs text-emerald-700 font-medium">
                        Kunci: {String.fromCharCode(65 + (q.correctOptionIndex ?? 0))}.{' '}
                        {q.options[q.correctOptionIndex ?? 0]}
                      </p>
                    )}
                    {q.type === 'pg_kompleks' && q.options && (
                      <p className="text-xs text-emerald-700 font-medium">
                        Kunci Kompleks:{' '}
                        {(q.correctOptionIndices ?? [])
                          .map((i) => `${String.fromCharCode(65 + i)}. ${q.options?.[i] ?? ''}`)
                          .join(' | ')}
                      </p>
                    )}
                    {q.type === 'benar_salah' && q.statements && (
                      <p className="text-xs text-emerald-700 font-medium">
                        {q.statements.length} pernyataan:{' '}
                        {q.statements
                          .map((st, si) => `${si + 1}) ${st.isTrue ? 'Benar' : 'Salah'}`)
                          .join(' · ')}
                      </p>
                    )}
                    {q.type === 'menjodohkan' && q.matchingPairs && (
                      <p className="text-xs text-emerald-700 font-medium">
                        {q.matchingPairs.length} pasangan:{' '}
                        {q.matchingPairs
                          .map((p) => `${p.left} → ${p.right}`)
                          .join(' · ')}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    aria-label={`Hapus soal nomor ${index + 1}`}
                    onClick={() => onDeleteQuestion(q.id)}
                    className="p-2 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-lg shrink-0 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            )}
          </section>
        </div>

        {/* Create Exam Modal */}
        {showExamModal && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-exam-title"
            className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4"
          >
            <form
              onSubmit={handleCreateExam}
              className="bg-white border border-slate-200 rounded-xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <h2
                id="create-exam-title"
                className="font-display text-lg font-bold text-slate-900"
              >
                Buat Paket Ujian Baru
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label
                    htmlFor="new-ex-title"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Judul Ujian
                  </label>
                  <input
                    id="new-ex-title"
                    required
                    type="text"
                    value={newExTitle}
                    onChange={(e) => setNewExTitle(e.target.value)}
                    placeholder="Contoh: Ujian Harian Aljabar Kelas 9"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label
                    htmlFor="new-ex-subject"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Mata Pelajaran
                  </label>
                  <input
                    id="new-ex-subject"
                    type="text"
                    readOnly
                    value={newExSubject}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-700"
                  />
                </div>
                <div>
                  <label
                    htmlFor="new-ex-class"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Target Kelas
                  </label>
                  <select
                    id="new-ex-class"
                    value={newExClass}
                    onChange={(e) => setNewExClass(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Semua Kelas 9">Semua Kelas 9</option>
                    <option value="9A">9A</option>
                    <option value="9B">9B</option>
                    <option value="Semua Kelas 8">Semua Kelas 8</option>
                    <option value="Semua Kelas 7">Semua Kelas 7</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="new-ex-dur"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Durasi (menit)
                  </label>
                  <input
                    id="new-ex-dur"
                    type="number"
                    min={5}
                    value={newExDuration}
                    onChange={(e) => setNewExDuration(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label
                    htmlFor="new-ex-token"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Token Ujian
                  </label>
                  <input
                    id="new-ex-token"
                    type="text"
                    value={newExToken}
                    onChange={(e) => setNewExToken(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 text-sm font-mono uppercase border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newExRequireToken}
                  onChange={(e) => setNewExRequireToken(e.target.checked)}
                  className="accent-teal-700"
                />
                <span>Wajibkan siswa memasukkan token saat memulai</span>
              </label>

              <div>
                <p className="text-xs font-semibold text-slate-700 mb-2">
                  Pilih Soal Mapel {teacherSubject} ({newExSelectedQs.length} dipilih)
                </p>
                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                  {scopedQuestions.map((q) => {
                    const checked = newExSelectedQs.includes(q.id);
                    return (
                      <label
                        key={q.id}
                        className="flex items-start gap-2.5 p-2.5 text-xs hover:bg-slate-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setNewExSelectedQs((prev) =>
                              checked
                                ? prev.filter((id) => id !== q.id)
                                : [...prev, q.id]
                            )
                          }
                          className="mt-0.5 accent-teal-700"
                        />
                        <span className="text-slate-700">
                          <strong className="text-slate-900">
                            [{q.subject} · {q.type.toUpperCase()}]
                          </strong>{' '}
                          {q.prompt}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowExamModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={newExSelectedQs.length === 0}
                  className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-40 rounded-lg cursor-pointer"
                >
                  Terbitkan Ujian
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  // TAB 3: Kelola Nilai Per Kelas, Download Excel, Log Pengerjaan Siswa & Koreksi Esai
  if (activeTab === 'guru-nilai') {
    const gradingSub = scopedSubmissions.find((s) => s.id === gradingSubId);
    const gradingExam =
      scopedExams.find((e) => e.id === gradingSub?.examId) ?? selectedExam;
    const gradingExamQuestions = gradingExam
      ? scopedQuestions.filter((q) => gradingExam.questionIds.includes(q.id))
      : [];
    const essayQuestions = gradingExamQuestions.filter((q) => q.type === 'esai');

    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <GradeAndLogReportPanel
          title={`Nilai Per Kelas & Log Siswa · ${teacherSubject || 'Mapel Guru'}`}
          subtitle={`Akses khusus mata pelajaran ${teacherSubject || 'Anda'}: pantau nilai per kelas, koreksi esai, unduh Excel (.xlsx), dan audit log pengerjaan.`}
          exams={scopedExams}
          questions={scopedQuestions}
          submissions={scopedSubmissions}
          activityLogs={scopedLogs}
          selectedExamId={reportExamId}
          onChangeExamId={setReportExamId}
          onOpenEssayGrading={(sub, exam) => {
            setSelectedExamId(exam.id);
            openEssayGrading(sub);
          }}
        />

        {/* Essay Grading Modal */}
        {gradingSub && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="grade-essay-title"
            className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4"
          >
            <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
              <div>
                <h2
                  id="grade-essay-title"
                  className="font-display text-lg font-bold text-slate-900"
                >
                  Koreksi Jawaban Esai · {gradingSub.studentName}
                </h2>
                <p className="text-xs text-slate-500">
                  NIS {gradingSub.studentNis} · Kelas {gradingSub.studentClass}
                </p>
              </div>

              <div className="space-y-4">
                {essayQuestions.map((q) => {
                  const ans = gradingSub.answers[q.id];
                  return (
                    <div
                      key={q.id}
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3"
                    >
                      <p className="text-sm font-semibold text-slate-900">
                        {q.prompt}{' '}
                        <span className="font-mono text-xs text-slate-500">
                          (Maks {q.points} poin)
                        </span>
                      </p>
                      {q.rubric && (
                        <p className="text-xs text-slate-600">
                          Rubrik: {q.rubric}
                        </p>
                      )}
                      <div className="p-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 whitespace-pre-line">
                        {typeof ans === 'string' && ans.trim()
                          ? ans
                          : '(Siswa tidak mengisi jawaban esai)'}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Skor Diberikan (0–{q.points})
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={q.points}
                            value={draftEssayScores[q.id] ?? 0}
                            onChange={(e) =>
                              setDraftEssayScores((prev) => ({
                                ...prev,
                                [q.id]: Number(e.target.value),
                              }))
                            }
                            className="w-full px-3 py-1.5 text-sm font-mono border border-slate-300 rounded-lg bg-white"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Catatan Guru
                          </label>
                          <input
                            type="text"
                            value={draftEssayFeedback[q.id] ?? ''}
                            onChange={(e) =>
                              setDraftEssayFeedback((prev) => ({
                                ...prev,
                                [q.id]: e.target.value,
                              }))
                            }
                            placeholder="Masukan singkat untuk siswa..."
                            className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setGradingSubId(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={saveEssayGrading}
                  className="px-4 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
                >
                  Simpan & Hitung Nilai Akhir
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // TAB 1 (Default): Pemantauan Progres Live
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-teal-700 mb-1">
            Portal Guru · {user.mapel || 'Pengajar'}
          </p>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Pemantauan Progres Ujian Siswa
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Pantau peserta yang sedang aktif mengerjakan soal, progres jawaban, dan ketuntasan kelas.
          </p>
        </div>

        <select
          aria-label="Pilih jadwal ujian yang dipantau"
          value={selectedExam?.id ?? ''}
          onChange={(e) => setSelectedExamId(e.target.value)}
          className="px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-lg font-medium text-slate-900"
        >
          {scopedExams.length === 0 ? (
            <option value="">Belum ada ujian mapel {teacherSubject}</option>
          ) : (
            scopedExams.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.title} ({ex.targetClass})
              </option>
            ))
          )}
        </select>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Peserta Terdaftar</p>
          <p className="font-mono text-2xl font-bold text-slate-900 tabular-nums mt-1">
            {progressStats.eligibleCount}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Target {selectedExam?.targetClass ?? '-'}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Sedang Mengerjakan</p>
          <p className="font-mono text-2xl font-bold text-amber-700 tabular-nums mt-1">
            {progressStats.inProgressCount}
          </p>
          <p className="text-xs text-slate-500 mt-1">Sesi aktif berlangsung</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Sudah Mengumpulkan</p>
          <p className="font-mono text-2xl font-bold text-emerald-700 tabular-nums mt-1">
            {progressStats.completedCount}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Belum mulai: {progressStats.notStartedCount} siswa
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Rata-rata Sementara</p>
          <p className="font-mono text-2xl font-bold text-slate-900 tabular-nums mt-1">
            {progressStats.averageScore}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Token: <span className="font-mono font-semibold">{selectedExam?.token ?? '-'}</span>
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchStudent}
              onChange={(e) => setSearchStudent(e.target.value)}
              placeholder="Cari nama atau NIS siswa..."
              aria-label="Cari peserta ujian"
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(
              [
                { id: 'semua', label: 'Semua Peserta' },
                { id: 'sedang_mengerjakan', label: 'Sedang Mengerjakan' },
                { id: 'selesai', label: 'Selesai' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setProgressFilter(f.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 cursor-pointer ${
                  progressFilter === f.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {filteredSubs.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-600">
            Belum ada aktivitas peserta yang cocok dengan filter ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-5">NIS</th>
                  <th className="py-3 px-4">Nama Siswa</th>
                  <th className="py-3 px-4">Kelas</th>
                  <th className="py-3 px-4">Progres Soal</th>
                  <th className="py-3 px-4 text-right">Pindah Tab</th>
                  <th className="py-3 px-4 text-right">Nilai</th>
                  <th className="py-3 px-5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredSubs.map((sub) => {
                  const totalQ = selectedExam?.questionIds.length ?? 0;
                  const answered = Object.keys(sub.answers).length;
                  return (
                    <tr key={sub.id} className="hover:bg-slate-50">
                      <td className="py-3.5 px-5 font-mono tabular-nums text-slate-600">
                        {sub.studentNis}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-900">
                        {sub.studentName}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {sub.studentClass}
                      </td>
                      <td className="py-3.5 px-4 font-mono tabular-nums text-slate-700">
                        {answered}/{totalQ} soal
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700">
                        {sub.tabSwitches}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold tabular-nums text-slate-900">
                        {sub.finalScore}
                      </td>
                      <td className="py-3.5 px-5 text-xs">
                        {sub.status === 'selesai' ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Selesai
                          </span>
                        ) : (
                          <span className="font-medium text-amber-700">
                            Sedang Mengerjakan
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
