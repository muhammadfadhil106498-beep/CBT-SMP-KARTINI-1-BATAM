import type {
  Exam,
  ExamSubmission,
  Question,
  ScheduleConflict,
  User,
  UserRole,
} from '../types/exam';

export type PortalTab =
  | 'siswa-ujian'
  | 'siswa-nilai'
  | 'guru-progres'
  | 'guru-soal'
  | 'guru-nilai'
  | 'guru-ai'
  | 'admin-pengguna'
  | 'admin-jadwal'
  | 'admin-sistem';

const ROLE_ALLOWED_TABS: Record<UserRole, PortalTab[]> = {
  siswa: ['siswa-ujian', 'siswa-nilai'],
  guru: ['guru-progres', 'guru-soal', 'guru-nilai', 'guru-ai'],
  admin: ['admin-pengguna', 'admin-jadwal', 'admin-sistem'],
};

export function getDefaultTabForRole(role: UserRole): PortalTab {
  return ROLE_ALLOWED_TABS[role][0];
}

export function canAccessTab(role: UserRole, tab: PortalTab): boolean {
  return ROLE_ALLOWED_TABS[role].includes(tab);
}

export function authenticateUser(
  users: User[],
  usernameInput: string,
  passwordInput: string
): { user?: User; error?: string } {
  const cleanUsername = usernameInput.trim().toLowerCase();
  const cleanPassword = passwordInput.trim();

  if (!cleanUsername || !cleanPassword) {
    return { error: 'Username (NIS/NIP) dan kata sandi wajib diisi.' };
  }

  const matched = users.find(
    (u) => u.username.trim().toLowerCase() === cleanUsername
  );

  if (!matched) {
    return { error: 'Akun tidak ditemukan. Periksa kembali NIS/NIP Anda.' };
  }

  if (matched.password !== cleanPassword) {
    return { error: 'Kata sandi yang Anda masukkan tidak sesuai.' };
  }

  if (!matched.active) {
    return { error: 'Akun Anda sedang dinonaktifkan oleh Admin sekolah.' };
  }

  return { user: matched };
}

export function isClassEligibleForExam(
  studentClass: string,
  examTargetClass: string
): boolean {
  const normStudent = studentClass.trim().toLowerCase();
  const normTarget = examTargetClass.trim().toLowerCase();

  if (!normTarget || normTarget === 'semua kelas') return true;
  if (normTarget === normStudent) return true;

  // Match "Semua Kelas 9" against "9A", "9B", etc.
  const allGradeMatch = normTarget.match(/^semua kelas\s*(\d)$/);
  if (allGradeMatch) {
    return normStudent.startsWith(allGradeMatch[1]);
  }

  // Match comma-separated classes e.g. "9A, 9B"
  const listed = normTarget.split(',').map((item) => item.trim());
  return listed.includes(normStudent);
}

export function validateExamToken(
  exam: Exam,
  inputToken: string,
  globalRequireToken: boolean
): { valid: boolean; reason?: string } {
  const needsToken = exam.requireToken || globalRequireToken;
  if (!needsToken) {
    return { valid: true };
  }

  const cleanInput = inputToken.trim().toUpperCase();
  const expected = exam.token.trim().toUpperCase();

  if (!cleanInput) {
    return { valid: false, reason: 'Token ujian wajib dimasukkan.' };
  }

  if (cleanInput !== expected) {
    return {
      valid: false,
      reason: 'Token ujian tidak valid. Hubungi guru pengawas atau cek kode kelas.',
    };
  }

  return { valid: true };
}

export interface GradeCalculation {
  autoScore: number;
  essayScoreTotal: number;
  maxPoints: number;
  finalScore: number;
  pgCorrectCount: number;
  pgTotalCount: number;
  essayTotalCount: number;
  essayGradedCount: number;
  hasPendingEssay: boolean;
}

export function gradeSubmission(
  examQuestions: Question[],
  answers: Record<string, number | string>,
  essayScores: Record<string, number> = {}
): GradeCalculation {
  let autoScore = 0;
  let essayScoreTotal = 0;
  let maxPoints = 0;
  let pgCorrectCount = 0;
  let pgTotalCount = 0;
  let essayTotalCount = 0;
  let essayGradedCount = 0;

  for (const question of examQuestions) {
    const pts = Math.max(0, Number(question.points) || 0);
    maxPoints += pts;

    if (question.type === 'pg') {
      pgTotalCount += 1;
      const studentAns = answers[question.id];
      if (
        typeof studentAns === 'number' &&
        studentAns === question.correctOptionIndex
      ) {
        autoScore += pts;
        pgCorrectCount += 1;
      }
    } else {
      essayTotalCount += 1;
      if (Object.prototype.hasOwnProperty.call(essayScores, question.id)) {
        const clamped = Math.min(pts, Math.max(0, Number(essayScores[question.id]) || 0));
        essayScoreTotal += clamped;
        essayGradedCount += 1;
      }
    }
  }

  const earned = autoScore + essayScoreTotal;
  const finalScore =
    maxPoints > 0 ? Math.round((earned / maxPoints) * 1000) / 10 : 0;

  return {
    autoScore,
    essayScoreTotal,
    maxPoints,
    finalScore,
    pgCorrectCount,
    pgTotalCount,
    essayTotalCount,
    essayGradedCount,
    hasPendingEssay: essayTotalCount > essayGradedCount,
  };
}

export function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) {
    const hh = String(hours).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

export function detectScheduleConflicts(exams: Exam[]): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];
  const activeExams = exams.filter((e) => e.status !== 'draft');

  for (let i = 0; i < activeExams.length; i++) {
    for (let j = i + 1; j < activeExams.length; j++) {
      const a = activeExams[i];
      const b = activeExams[j];

      const aStart = Date.parse(a.startTime);
      const aEnd = Date.parse(a.endTime);
      const bStart = Date.parse(b.startTime);
      const bEnd = Date.parse(b.endTime);

      if (
        Number.isNaN(aStart) ||
        Number.isNaN(aEnd) ||
        Number.isNaN(bStart) ||
        Number.isNaN(bEnd)
      ) {
        continue;
      }

      const overlaps = aStart < bEnd && bStart < aEnd;
      if (!overlaps) continue;

      const sameRoom =
        a.room.trim().toLowerCase() === b.room.trim().toLowerCase() &&
        a.room.trim() !== '';
      const sameTarget =
        a.targetClass.trim().toLowerCase() === b.targetClass.trim().toLowerCase() ||
        isClassEligibleForExam(a.targetClass, b.targetClass) ||
        isClassEligibleForExam(b.targetClass, a.targetClass);

      if (sameRoom || sameTarget) {
        const reasons: string[] = [];
        if (sameTarget) reasons.push(`kelas bentrok (${a.targetClass} / ${b.targetClass})`);
        if (sameRoom) reasons.push(`ruang sama (${a.room})`);
        conflicts.push({
          examAId: a.id,
          examBId: b.id,
          reason: `${a.title} & ${b.title}: ${reasons.join(' dan ')}`,
        });
      }
    }
  }

  return conflicts;
}

function escapeCsvCell(value: string | number): string {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportSubmissionsToCsv(
  exam: Exam,
  submissions: ExamSubmission[]
): string {
  const headers = [
    'NIS',
    'Nama Siswa',
    'Kelas',
    'Status',
    'Skor PG',
    'Skor Esai',
    'Nilai Akhir (0-100)',
    'Peringatan Tab',
    'Waktu Kumpul',
  ];

  const rows = submissions
    .filter((s) => s.examId === exam.id)
    .map((s) => [
      s.studentNis,
      s.studentName,
      s.studentClass,
      s.status === 'selesai' ? 'Selesai' : 'Sedang Mengerjakan',
      s.autoScore,
      s.essayScoreTotal,
      s.finalScore,
      s.tabSwitches,
      s.submittedAt ?? '-',
    ]);

  return [headers, ...rows]
    .map((row) => row.map(escapeCsvCell).join(','))
    .join('\n');
}

export function computeExamProgressStats(
  exam: Exam,
  submissions: ExamSubmission[],
  eligibleStudentsCount: number
) {
  const examSubs = submissions.filter((s) => s.examId === exam.id);
  const completed = examSubs.filter((s) => s.status === 'selesai');
  const inProgress = examSubs.filter((s) => s.status === 'sedang_mengerjakan');
  const avgScore =
    completed.length > 0
      ? Math.round(
          (completed.reduce((acc, s) => acc + s.finalScore, 0) /
            completed.length) *
            10
        ) / 10
      : 0;

  return {
    eligibleCount: eligibleStudentsCount,
    inProgressCount: inProgress.length,
    completedCount: completed.length,
    notStartedCount: Math.max(
      0,
      eligibleStudentsCount - inProgress.length - completed.length
    ),
    averageScore: avgScore,
  };
}
