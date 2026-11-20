import * as XLSX from 'xlsx';
import type { ActivityLog, Exam, ExamSubmission } from '../types/exam';

export interface ClassGradeSummary {
  kelas: string;
  submissions: ExamSubmission[];
  totalParticipants: number;
  completedCount: number;
  inProgressCount: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  totalTabViolations: number;
}

export function normalizeClassName(kelas: string): string {
  const clean = kelas.trim().toUpperCase();
  return clean || 'TANPA KELAS';
}

export function groupSubmissionsByClass(
  submissions: ExamSubmission[],
  examId?: string
): ClassGradeSummary[] {
  const scoped =
    examId && examId !== 'semua'
      ? submissions.filter((s) => s.examId === examId)
      : submissions;

  const grouped = new Map<string, ExamSubmission[]>();
  for (const sub of scoped) {
    const key = normalizeClassName(sub.studentClass);
    const list = grouped.get(key) ?? [];
    list.push(sub);
    grouped.set(key, list);
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b, 'id', { numeric: true }))
    .map(([kelas, list]) => {
      const sortedSubs = [...list].sort((a, b) =>
        a.studentName.localeCompare(b.studentName, 'id')
      );
      const completed = sortedSubs.filter((s) => s.status === 'selesai');
      const inProgress = sortedSubs.filter(
        (s) => s.status === 'sedang_mengerjakan'
      );
      const scores = completed.map((s) => s.finalScore);
      const averageScore =
        scores.length > 0
          ? Math.round(
              (scores.reduce((sum, v) => sum + v, 0) / scores.length) * 10
            ) / 10
          : 0;
      const highestScore = scores.length > 0 ? Math.max(...scores) : 0;
      const lowestScore = scores.length > 0 ? Math.min(...scores) : 0;
      const totalTabViolations = sortedSubs.reduce(
        (sum, s) => sum + (s.tabSwitches || 0),
        0
      );

      return {
        kelas,
        submissions: sortedSubs,
        totalParticipants: sortedSubs.length,
        completedCount: completed.length,
        inProgressCount: inProgress.length,
        averageScore,
        highestScore,
        lowestScore,
        totalTabViolations,
      };
    });
}

export interface StudentLogFilter {
  examId?: string;
  kelas?: string;
  search?: string;
}

const STUDENT_EXAM_ACTIONS = new Set([
  'Masuk Kode Ujian',
  'Mulai Ujian',
  'Kumpul Ujian',
  'Kumpul Ujian Otomatis',
  'Pelanggaran Tab',
  'Keluar Layar Penuh',
  'Layar Terkunci',
  'Buka Kunci Layar',
]);

export function filterStudentExamLogs(
  logs: ActivityLog[],
  filter: StudentLogFilter = {}
): ActivityLog[] {
  const q = (filter.search ?? '').trim().toLowerCase();
  const targetExam = filter.examId && filter.examId !== 'semua' ? filter.examId : null;
  const targetClass =
    filter.kelas && filter.kelas !== 'semua'
      ? normalizeClassName(filter.kelas)
      : null;

  return logs.filter((log) => {
    const isStudentExamEvent =
      log.actorRole === 'siswa' || STUDENT_EXAM_ACTIONS.has(log.action);
    if (!isStudentExamEvent) return false;
    if (targetExam && log.examId && log.examId !== targetExam) return false;
    if (targetExam && !log.examId) return false;
    if (targetClass) {
      const logClass = log.studentClass ? normalizeClassName(log.studentClass) : '';
      if (logClass !== targetClass) return false;
    }
    if (q) {
      const hay = `${log.actorName} ${log.studentNis ?? ''} ${log.studentClass ?? ''} ${log.examTitle ?? ''} ${log.action} ${log.detail}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function sanitizeSheetName(raw: string): string {
  return raw.replace(/[\\/?*[\]:]/g, '-').slice(0, 31) || 'Sheet';
}

export function buildGradeReportWorkbook(
  exams: Exam[],
  submissions: ExamSubmission[],
  activityLogs: ActivityLog[],
  selectedExamId?: string
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const examById = new Map(exams.map((e) => [e.id, e]));
  const scopedSubs =
    selectedExamId && selectedExamId !== 'semua'
      ? submissions.filter((s) => s.examId === selectedExamId)
      : submissions;

  const classGroups = groupSubmissionsByClass(scopedSubs);

  // Sheet 1: Rekap Per Kelas
  const recapRows = classGroups.map((g) => ({
    Kelas: g.kelas,
    'Total Peserta': g.totalParticipants,
    Selesai: g.completedCount,
    'Sedang Mengerjakan': g.inProgressCount,
    'Rata-rata Nilai': g.averageScore,
    'Nilai Tertinggi': g.highestScore,
    'Nilai Terendah': g.lowestScore,
    'Total Pelanggaran Tab': g.totalTabViolations,
  }));
  const wsRecap = XLSX.utils.json_to_sheet(
    recapRows.length > 0
      ? recapRows
      : [{ Keterangan: 'Belum ada data hasil ujian untuk filter terpilih.' }]
  );
  wsRecap['!cols'] = [
    { wch: 14 },
    { wch: 14 },
    { wch: 12 },
    { wch: 18 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 22 },
  ];
  XLSX.utils.book_append_sheet(wb, wsRecap, 'Rekap Per Kelas');

  // Sheet 2: Semua Hasil Nilai
  const allGradeRows = [...scopedSubs]
    .sort((a, b) => {
      const clsCmp = normalizeClassName(a.studentClass).localeCompare(
        normalizeClassName(b.studentClass),
        'id',
        { numeric: true }
      );
      if (clsCmp !== 0) return clsCmp;
      return a.studentName.localeCompare(b.studentName, 'id');
    })
    .map((sub, idx) => {
      const exam = examById.get(sub.examId);
      return {
        No: idx + 1,
        'No. Peserta / NIS': sub.studentNis,
        'Nama Siswa': sub.studentName,
        Kelas: normalizeClassName(sub.studentClass),
        Ujian: exam?.title ?? sub.examId,
        'Mata Pelajaran': exam?.subject ?? '-',
        Status: sub.status === 'selesai' ? 'Selesai' : 'Sedang Mengerjakan',
        'Skor Otomatis': sub.autoScore,
        'Skor Esai': sub.essayScoreTotal,
        'Nilai Akhir (0-100)': sub.finalScore,
        'Pelanggaran Tab': sub.tabSwitches,
        'Waktu Mulai': sub.startedAt.slice(0, 19).replace('T', ' '),
        'Waktu Kumpul': sub.submittedAt
          ? sub.submittedAt.slice(0, 19).replace('T', ' ')
          : '-',
        Keterangan: sub.autoSubmittedReason ?? '-',
      };
    });

  const wsAll = XLSX.utils.json_to_sheet(
    allGradeRows.length > 0
      ? allGradeRows
      : [{ Keterangan: 'Belum ada peserta yang mengerjakan ujian ini.' }]
  );
  wsAll['!cols'] = [
    { wch: 5 },
    { wch: 18 },
    { wch: 24 },
    { wch: 10 },
    { wch: 28 },
    { wch: 18 },
    { wch: 18 },
    { wch: 14 },
    { wch: 12 },
    { wch: 18 },
    { wch: 16 },
    { wch: 20 },
    { wch: 20 },
    { wch: 36 },
  ];
  XLSX.utils.book_append_sheet(wb, wsAll, 'Semua Hasil Nilai');

  // Per-class sheets
  const usedSheetNames = new Set(['Rekap Per Kelas', 'Semua Hasil Nilai']);
  for (const group of classGroups) {
    let sheetName = sanitizeSheetName(`Kelas ${group.kelas}`);
    let suffix = 2;
    while (usedSheetNames.has(sheetName)) {
      sheetName = sanitizeSheetName(`Kelas ${group.kelas} (${suffix})`);
      suffix += 1;
    }
    usedSheetNames.add(sheetName);

    const rows = group.submissions.map((sub, idx) => {
      const exam = examById.get(sub.examId);
      return {
        No: idx + 1,
        'No. Peserta / NIS': sub.studentNis,
        'Nama Siswa': sub.studentName,
        Kelas: group.kelas,
        Ujian: exam?.title ?? sub.examId,
        Status: sub.status === 'selesai' ? 'Selesai' : 'Sedang Mengerjakan',
        'Skor Otomatis': sub.autoScore,
        'Skor Esai': sub.essayScoreTotal,
        'Nilai Akhir': sub.finalScore,
        'Pelanggaran Tab': sub.tabSwitches,
        'Waktu Kumpul': sub.submittedAt
          ? sub.submittedAt.slice(0, 19).replace('T', ' ')
          : '-',
      };
    });
    const wsClass = XLSX.utils.json_to_sheet(rows);
    wsClass['!cols'] = [
      { wch: 5 },
      { wch: 18 },
      { wch: 24 },
      { wch: 10 },
      { wch: 28 },
      { wch: 18 },
      { wch: 14 },
      { wch: 12 },
      { wch: 12 },
      { wch: 16 },
      { wch: 20 },
    ];
    XLSX.utils.book_append_sheet(wb, wsClass, sheetName);
  }

  // Sheet: Log Pengerjaan Siswa
  const studentLogs = filterStudentExamLogs(activityLogs, { examId: selectedExamId });
  const logRows = studentLogs.map((log, idx) => ({
    No: idx + 1,
    Waktu: log.timestamp.slice(0, 19).replace('T', ' '),
    'No. Peserta / NIS': log.studentNis ?? '-',
    'Nama Siswa': log.actorName,
    Kelas: log.studentClass ?? '-',
    Ujian: log.examTitle ?? '-',
    Aktivitas: log.action,
    Detail: log.detail,
  }));
  const wsLogs = XLSX.utils.json_to_sheet(
    logRows.length > 0
      ? logRows
      : [{ Keterangan: 'Belum ada log pengerjaan siswa tercatat.' }]
  );
  wsLogs['!cols'] = [
    { wch: 5 },
    { wch: 20 },
    { wch: 18 },
    { wch: 24 },
    { wch: 10 },
    { wch: 26 },
    { wch: 22 },
    { wch: 46 },
  ];
  XLSX.utils.book_append_sheet(wb, wsLogs, 'Log Pengerjaan Siswa');

  return wb;
}

export function downloadGradeReportExcel(
  exams: Exam[],
  submissions: ExamSubmission[],
  activityLogs: ActivityLog[],
  selectedExamId?: string
): void {
  const wb = buildGradeReportWorkbook(
    exams,
    submissions,
    activityLogs,
    selectedExamId
  );
  const exam = exams.find((e) => e.id === selectedExamId);
  const suffix = exam
    ? exam.subject.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    : 'semua-ujian';
  XLSX.writeFile(wb, `laporan-nilai-${suffix}-smp-kartini-1-batam.xlsx`);
}
