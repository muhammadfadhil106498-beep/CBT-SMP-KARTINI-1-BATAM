import React, { useMemo, useState } from 'react';
import {
  Activity,
  Download,
  FileSpreadsheet,
  Search,
  ShieldAlert,
  Users,
} from 'lucide-react';
import type {
  ActivityLog,
  Exam,
  ExamSubmission,
  Question,
} from '../types/exam';
import { exportSubmissionsToCsv } from '../utils/examEngine';
import {
  downloadGradeReportExcel,
  filterStudentExamLogs,
  groupSubmissionsByClass,
  normalizeClassName,
} from '../utils/gradeReport';

interface GradeAndLogReportPanelProps {
  title: string;
  subtitle: string;
  exams: Exam[];
  questions: Question[];
  submissions: ExamSubmission[];
  activityLogs: ActivityLog[];
  selectedExamId: string;
  onChangeExamId: (examId: string) => void;
  onOpenEssayGrading?: (sub: ExamSubmission, exam: Exam) => void;
}

export const GradeAndLogReportPanel: React.FC<GradeAndLogReportPanelProps> = ({
  title,
  subtitle,
  exams,
  questions,
  submissions,
  activityLogs,
  selectedExamId,
  onChangeExamId,
  onOpenEssayGrading,
}) => {
  const [selectedClass, setSelectedClass] = useState<string>('semua');
  const [searchQuery, setSearchQuery] = useState('');

  const examById = useMemo(
    () => new Map(exams.map((ex) => [ex.id, ex])),
    [exams]
  );

  const selectedExam =
    selectedExamId !== 'semua' ? examById.get(selectedExamId) : undefined;

  const availableClasses = useMemo(() => {
    const set = new Set<string>();
    const scopedSubs =
      selectedExamId === 'semua'
        ? submissions
        : submissions.filter((s) => s.examId === selectedExamId);
    for (const sub of scopedSubs) {
      set.add(normalizeClassName(sub.studentClass));
    }
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, 'id', { numeric: true })
    );
  }, [submissions, selectedExamId]);

  const filteredSubmissions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return submissions.filter((s) => {
      if (selectedExamId !== 'semua' && s.examId !== selectedExamId) {
        return false;
      }
      if (
        selectedClass !== 'semua' &&
        normalizeClassName(s.studentClass) !== selectedClass
      ) {
        return false;
      }
      if (q) {
        const hay = `${s.studentName} ${s.studentNis} ${s.studentClass}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [submissions, selectedExamId, selectedClass, searchQuery]);

  const classGroups = useMemo(
    () => groupSubmissionsByClass(filteredSubmissions),
    [filteredSubmissions]
  );

  const studentLogs = useMemo(
    () =>
      filterStudentExamLogs(activityLogs, {
        examId: selectedExamId,
        kelas: selectedClass,
        search: searchQuery,
      }),
    [activityLogs, selectedExamId, selectedClass, searchQuery]
  );

  const handleDownloadExcel = () => {
    downloadGradeReportExcel(
      exams,
      filteredSubmissions,
      activityLogs,
      selectedExamId === 'semua' ? undefined : selectedExamId
    );
  };

  const handleDownloadCsv = () => {
    if (!selectedExam) return;
    const csv = exportSubmissionsToCsv(selectedExam, filteredSubmissions);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nilai-${selectedExam.subject.toLowerCase().replace(/\s+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            {title}
          </h1>
          <p className="text-sm text-slate-600 mt-1">{subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            aria-label="Filter ujian laporan nilai"
            value={selectedExamId}
            onChange={(e) => {
              onChangeExamId(e.target.value);
              setSelectedClass('semua');
            }}
            className="px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg font-medium text-slate-900"
          >
            <option value="semua">Semua Ujian</option>
            {exams.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.title} ({ex.token})
              </option>
            ))}
          </select>

          <select
            aria-label="Filter kelas laporan nilai"
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg font-medium text-slate-900"
          >
            <option value="semua">Semua Kelas</option>
            {availableClasses.map((cls) => (
              <option key={cls} value={cls}>
                Kelas {cls}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleDownloadExcel}
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Download Excel (.xlsx)</span>
          </button>

          {selectedExam && (
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama siswa, no. peserta, atau kelas..."
            aria-label="Cari peserta dalam laporan"
            className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
          />
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
          <span>
            Total Kelas:{' '}
            <strong className="font-mono text-slate-900">
              {classGroups.length}
            </strong>
          </span>
          <span>
            Total Peserta:{' '}
            <strong className="font-mono text-slate-900">
              {filteredSubmissions.length}
            </strong>
          </span>
          <span>
            Log Aktivitas Siswa:{' '}
            <strong className="font-mono text-slate-900">
              {studentLogs.length}
            </strong>
          </span>
        </div>
      </div>

      {/* Per-Class Grade Tables */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-teal-700" />
          <h2 className="font-display text-lg font-bold text-slate-900">
            Tabel Hasil Nilai Per Kelas
          </h2>
        </div>

        {classGroups.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-600">
            Belum ada data hasil nilai siswa untuk filter yang dipilih.
          </div>
        ) : (
          classGroups.map((group) => (
            <div
              key={group.kelas}
              className="bg-white border border-slate-200 rounded-xl overflow-hidden"
            >
              <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="font-display text-base font-bold text-slate-900">
                    Kelas {group.kelas}
                  </h3>
                  <p className="text-xs text-slate-600">
                    {group.totalParticipants} peserta · {group.completedCount} selesai ·{' '}
                    {group.inProgressCount} sedang mengerjakan
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <span className="text-slate-600">
                    Rata-rata:{' '}
                    <strong className="font-mono text-sm text-teal-700 tabular-nums">
                      {group.averageScore}
                    </strong>
                  </span>
                  <span className="text-slate-600">
                    Tertinggi:{' '}
                    <strong className="font-mono text-slate-900 tabular-nums">
                      {group.highestScore}
                    </strong>
                  </span>
                  <span className="text-slate-600">
                    Terendah:{' '}
                    <strong className="font-mono text-slate-900 tabular-nums">
                      {group.lowestScore}
                    </strong>
                  </span>
                  {group.totalTabViolations > 0 && (
                    <span className="inline-flex items-center gap-1 text-red-700 font-medium">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span className="font-mono tabular-nums">
                        {group.totalTabViolations} pelanggaran tab
                      </span>
                    </span>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-white text-xs font-semibold text-slate-600">
                      <th className="py-3 px-4 w-10">No</th>
                      <th className="py-3 px-4">No. Peserta</th>
                      <th className="py-3 px-4">Nama Siswa</th>
                      {selectedExamId === 'semua' && (
                        <th className="py-3 px-4">Ujian</th>
                      )}
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Skor Otomatis</th>
                      <th className="py-3 px-4 text-right">Skor Esai</th>
                      <th className="py-3 px-4 text-right">Nilai Akhir</th>
                      <th className="py-3 px-4 text-right">Tab</th>
                      <th className="py-3 px-4">Waktu Kumpul</th>
                      {onOpenEssayGrading && (
                        <th className="py-3 px-4 text-right">Tindakan</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {group.submissions.map((sub, idx) => {
                      const exam = examById.get(sub.examId);
                      const hasEssay = exam
                        ? questions.some(
                            (q) =>
                              exam.questionIds.includes(q.id) &&
                              q.type === 'esai'
                          )
                        : false;

                      return (
                        <tr key={sub.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-mono text-xs text-slate-500 tabular-nums">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-4 font-mono text-xs tabular-nums text-slate-700">
                            {sub.studentNis}
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-900">
                            {sub.studentName}
                          </td>
                          {selectedExamId === 'semua' && (
                            <td className="py-3 px-4 text-xs text-slate-600">
                              {exam?.title ?? sub.examId}
                            </td>
                          )}
                          <td className="py-3 px-4 text-xs">
                            {sub.status === 'selesai' ? (
                              <span className="font-semibold text-emerald-700">
                                Selesai
                              </span>
                            ) : (
                              <span className="font-semibold text-amber-700">
                                Mengerjakan
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                            {sub.autoScore}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                            {sub.essayScoreTotal}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold tabular-nums text-slate-900">
                            {sub.finalScore}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                            <span
                              className={
                                sub.tabSwitches > 0
                                  ? 'text-red-700 font-semibold'
                                  : 'text-slate-500'
                              }
                            >
                              {sub.tabSwitches}x
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-xs text-slate-500 tabular-nums">
                            {sub.submittedAt
                              ? sub.submittedAt.slice(0, 16).replace('T', ' ')
                              : '-'}
                          </td>
                          {onOpenEssayGrading && (
                            <td className="py-3 px-4 text-right">
                              {hasEssay && exam ? (
                                <button
                                  type="button"
                                  onClick={() => onOpenEssayGrading(sub, exam)}
                                  className="px-3 py-1.5 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-md cursor-pointer whitespace-nowrap"
                                >
                                  Nilai Esai
                                </button>
                              ) : (
                                <span className="text-xs text-slate-400">
                                  Otomatis
                                </span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </section>

      {/* Student Exam Execution Log */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-teal-700" />
            <h2 className="font-display text-base font-bold text-slate-900">
              Laporan Log Pengerjaan Ujian Siswa ({studentLogs.length})
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            Mencatat waktu masuk, pelanggaran pindah tab/layar penuh, dan pengumpulan
          </span>
        </div>

        {studentLogs.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Belum ada log pengerjaan ujian siswa untuk filter ini.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="py-3 px-4">Waktu</th>
                  <th className="py-3 px-4">No. Peserta</th>
                  <th className="py-3 px-4">Nama Siswa</th>
                  <th className="py-3 px-4">Kelas</th>
                  <th className="py-3 px-4">Ujian</th>
                  <th className="py-3 px-4">Aktivitas</th>
                  <th className="py-3 px-4">Detail Kejadian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {studentLogs.map((log) => {
                  const isViolation =
                    log.action.includes('Pelanggaran') ||
                    log.action.includes('Keluar Layar') ||
                    log.action.includes('Otomatis');
                  return (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-mono text-slate-500 whitespace-nowrap tabular-nums">
                        {log.timestamp.slice(0, 19).replace('T', ' ')}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-700 whitespace-nowrap">
                        {log.studentNis ?? '-'}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900">
                        {log.actorName}
                      </td>
                      <td className="py-2.5 px-4 text-slate-700 whitespace-nowrap">
                        {log.studentClass ?? '-'}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">
                        {log.examTitle ?? '-'}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span
                          className={`font-semibold ${
                            isViolation ? 'text-red-700' : 'text-teal-700'
                          }`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">{log.detail}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
