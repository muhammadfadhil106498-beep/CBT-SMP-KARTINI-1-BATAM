import type {
  ActivityLog,
  Exam,
  ExamSubmission,
  Question,
  QuestionAnswerValue,
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
  | 'admin-kartu'
  | 'admin-jadwal'
  | 'admin-laporan'
  | 'admin-sistem';

const ROLE_ALLOWED_TABS: Record<UserRole, PortalTab[]> = {
  siswa: ['siswa-ujian', 'siswa-nilai'],
  guru: ['guru-progres', 'guru-soal', 'guru-nilai', 'guru-ai'],
  admin: [
    'admin-pengguna',
    'admin-kartu',
    'admin-jadwal',
    'admin-laporan',
    'admin-sistem',
  ],
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

export function authenticateUserForRole(
  users: User[],
  usernameInput: string,
  passwordInput: string,
  expectedRole: UserRole
): { user?: User; error?: string } {
  const res = authenticateUser(users, usernameInput, passwordInput);
  if (res.error || !res.user) {
    return res;
  }
  if (res.user.role !== expectedRole) {
    const roleLabel =
      res.user.role === 'admin'
        ? 'Portal Admin'
        : res.user.role === 'guru'
        ? 'Portal Guru'
        : 'Portal Siswa';
    return {
      error: `Akun ini terdaftar sebagai ${res.user.role.toUpperCase()}. Silakan masuk melalui ${roleLabel}.`,
    };
  }
  return { user: res.user };
}

export function findExamByCode(
  exams: Exam[],
  codeInput: string
): { exam?: Exam; error?: string } {
  const cleanCode = codeInput.trim().toUpperCase();
  if (!cleanCode) {
    return { error: 'Masukkan kode ujian terlebih dahulu.' };
  }

  const matched = exams.find(
    (ex) => ex.token.trim().toUpperCase() === cleanCode
  );
  if (!matched) {
    return {
      error: 'Kode ujian tidak ditemukan. Periksa kembali kode ujian dari pengawas.',
    };
  }

  if (matched.status === 'draft') {
    return {
      error: `Ujian "${matched.title}" masih berstatus draf dan belum dibuka.`,
    };
  }
  if (matched.status === 'terjadwal') {
    return {
      error: `Ujian "${matched.title}" masih terjadwal (${matched.startTime.replace('T', ' ')}) dan belum dimulai.`,
    };
  }
  if (matched.status === 'selesai') {
    return {
      error: `Sesi ujian "${matched.title}" telah ditutup.`,
    };
  }

  return { exam: matched };
}

export function normalizeSubjectName(raw?: string): string {
  return (raw ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

const AMBIGUOUS_SUBJECT_PREFIXES = new Set([
  'bahasa',
  'pendidikan',
  'ilmu',
  'seni',
  'prakarya',
]);

export function isTeacherSubjectMatch(
  teacherSubject?: string,
  targetSubject?: string
): boolean {
  const normTarget = normalizeSubjectName(targetSubject);
  const rawTeacher = normalizeSubjectName(teacherSubject);
  if (!rawTeacher || !normTarget) return false;

  const teacherTokens = rawTeacher
    .split(/[,;/]+/)
    .map((part) => normalizeSubjectName(part))
    .filter(Boolean);

  return teacherTokens.some((token) => {
    if (token === normTarget) return true;
    const tokenFirstWord = token.split(' ')[0];
    const targetFirstWord = normTarget.split(' ')[0];
    if (
      token.split(' ').length === 1 &&
      !AMBIGUOUS_SUBJECT_PREFIXES.has(token) &&
      normTarget.startsWith(`${token} `)
    ) {
      return true;
    }
    if (
      normTarget.split(' ').length === 1 &&
      !AMBIGUOUS_SUBJECT_PREFIXES.has(normTarget) &&
      token.startsWith(`${normTarget} `)
    ) {
      return true;
    }
    return (
      tokenFirstWord === targetFirstWord &&
      !AMBIGUOUS_SUBJECT_PREFIXES.has(tokenFirstWord) &&
      (token.includes('terpadu') || normTarget.includes('terpadu'))
    );
  });
}

export function filterQuestionsForTeacher(
  questions: Question[],
  teacher: User
): Question[] {
  if (teacher.role !== 'guru') return questions;
  return questions.filter((q) => isTeacherSubjectMatch(teacher.mapel, q.subject));
}

export function filterExamsForTeacher(exams: Exam[], teacher: User): Exam[] {
  if (teacher.role !== 'guru') return exams;
  return exams.filter((ex) => isTeacherSubjectMatch(teacher.mapel, ex.subject));
}

export function filterSubmissionsForTeacher(
  submissions: ExamSubmission[],
  teacherExams: Exam[]
): ExamSubmission[] {
  const examIds = new Set(teacherExams.map((ex) => ex.id));
  return submissions.filter((s) => examIds.has(s.examId));
}

export function filterLogsForTeacher(
  logs: ActivityLog[],
  teacherExams: Exam[],
  teacher: User
): ActivityLog[] {
  const examIds = new Set(teacherExams.map((ex) => ex.id));
  return logs.filter(
    (log) =>
      (log.examId ? examIds.has(log.examId) : false) ||
      (log.actorRole === 'guru' &&
        log.actorName.trim().toLowerCase() === teacher.name.trim().toLowerCase())
  );
}

export interface ParticipantIdentityInput {
  name: string;
  kelas: string;
  participantNumber: string;
}

export type ParticipantLookupStatus =
  | 'empty'
  | 'not_found'
  | 'invalid_role'
  | 'inactive'
  | 'ineligible_class'
  | 'already_completed'
  | 'active_conflict'
  | 'valid';

export interface ParticipantLookupResult {
  status: ParticipantLookupStatus;
  student?: User;
  error?: string;
}

function normalizeParticipantName(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function lookupRegisteredParticipantForExam(
  users: User[],
  exam: Exam,
  participantNumber: string,
  existingSubmissions: ExamSubmission[] = []
): ParticipantLookupResult {
  const cleanNumber = participantNumber.trim();
  const normNumber = cleanNumber.toLowerCase();

  if (!cleanNumber) {
    return { status: 'empty' };
  }

  const matched = users.find(
    (u) => u.username.trim().toLowerCase() === normNumber
  );

  if (!matched) {
    return {
      status: 'not_found',
      error: `No. Peserta "${cleanNumber}" tidak terdaftar di Manajemen Data Pengguna. Hubungi Admin/Proktor untuk pendaftaran peserta.`,
    };
  }

  if (matched.role !== 'siswa') {
    return {
      status: 'invalid_role',
      error: `No. Peserta "${cleanNumber}" terdaftar sebagai ${matched.role.toUpperCase()}, bukan akun Siswa.`,
    };
  }

  if (!matched.active) {
    return {
      status: 'inactive',
      student: matched,
      error: `Akun siswa "${matched.name}" sedang dinonaktifkan oleh Admin.`,
    };
  }

  const cleanClass = matched.kelas.trim().toUpperCase();
  const normName = normalizeParticipantName(matched.name);

  if (!isClassEligibleForExam(cleanClass, exam.targetClass)) {
    return {
      status: 'ineligible_class',
      student: matched,
      error: `Kelas ${cleanClass} (${matched.name}) tidak termasuk target ujian ini (${exam.targetClass}).`,
    };
  }

  const examSubs = existingSubmissions.filter((s) => s.examId === exam.id);

  const completedByNumber = examSubs.find(
    (s) =>
      s.status === 'selesai' &&
      s.studentNis.trim().toLowerCase() === normNumber
  );
  if (completedByNumber) {
    return {
      status: 'already_completed',
      student: matched,
      error: `No. Peserta "${matched.username}" (${matched.name}, Kelas ${cleanClass}) sudah menyelesaikan ujian ini. 1 nomor peserta hanya dapat mengisi ujian 1 kali.`,
    };
  }

  const completedByName = examSubs.find(
    (s) =>
      s.status === 'selesai' &&
      normalizeParticipantName(s.studentName) === normName
  );
  if (completedByName) {
    return {
      status: 'already_completed',
      student: matched,
      error: `Nama "${matched.name}" sudah menyelesaikan ujian ini (No. Peserta ${completedByName.studentNis}). 1 nama siswa hanya dapat mengisi ujian 1 kali.`,
    };
  }

  const activeByNumber = examSubs.find(
    (s) =>
      s.status === 'sedang_mengerjakan' &&
      s.studentNis.trim().toLowerCase() === normNumber
  );
  if (
    activeByNumber &&
    normalizeParticipantName(activeByNumber.studentName) !== normName
  ) {
    return {
      status: 'active_conflict',
      student: matched,
      error: `No. Peserta "${matched.username}" sedang digunakan peserta lain (${activeByNumber.studentName}) pada ujian ini.`,
    };
  }

  const activeByNameDifferentNumber = examSubs.find(
    (s) =>
      s.status === 'sedang_mengerjakan' &&
      normalizeParticipantName(s.studentName) === normName &&
      s.studentNis.trim().toLowerCase() !== normNumber
  );
  if (activeByNameDifferentNumber) {
    return {
      status: 'active_conflict',
      student: matched,
      error: `Peserta atas nama "${matched.name}" sudah aktif mengerjakan ujian dengan No. Peserta ${activeByNameDifferentNumber.studentNis}.`,
    };
  }

  return {
    status: 'valid',
    student: {
      ...matched,
      kelas: cleanClass,
    },
  };
}

export function resolveParticipantForExam(
  users: User[],
  exam: Exam,
  identity: ParticipantIdentityInput,
  existingSubmissions: ExamSubmission[] = []
): { student?: User; error?: string } {
  const cleanNumber = identity.participantNumber.trim();
  if (!cleanNumber) {
    return { error: 'No. Peserta wajib diisi terlebih dahulu.' };
  }

  const lookup = lookupRegisteredParticipantForExam(
    users,
    exam,
    cleanNumber,
    existingSubmissions
  );

  if (lookup.status !== 'valid' || !lookup.student) {
    return {
      error:
        lookup.error ??
        'Data peserta belum valid atau belum terdaftar di Manajemen Data Pengguna.',
    };
  }

  const cleanName = identity.name.trim();
  const cleanClass = identity.kelas.trim().toUpperCase();
  if (!cleanName || !cleanClass) {
    return {
      error:
        'Pastikan Nama Peserta dan Kelas muncul otomatis dari data pengguna sebelum memulai ujian.',
    };
  }

  if (
    normalizeParticipantName(cleanName) !==
      normalizeParticipantName(lookup.student.name) ||
    cleanClass !== lookup.student.kelas.trim().toUpperCase()
  ) {
    return {
      error:
        'Nama atau Kelas tidak sesuai dengan data resmi Manajemen Data Pengguna untuk No. Peserta tersebut.',
    };
  }

  return { student: lookup.student };
}

export function resolveStudentForExamCode(
  users: User[],
  exam: Exam,
  nisInput = ''
): { student?: User; error?: string } {
  const lookup = lookupRegisteredParticipantForExam(users, exam, nisInput);
  if (lookup.status !== 'valid' || !lookup.student) {
    return {
      error:
        lookup.error ??
        'Nomor peserta wajib terdaftar di Manajemen Data Pengguna.',
    };
  }
  return { student: lookup.student };
}

export interface TabViolationOutcome {
  nextSwitches: number;
  maxWarnings: number;
  shouldLock: boolean;
  shouldAutoSubmit: boolean;
}

export function evaluateTabSwitchViolation(
  currentSwitches: number,
  maxWarnings = 3
): TabViolationOutcome {
  const safeLimit = Math.max(1, Math.floor(maxWarnings) || 3);
  const nextSwitches = Math.max(0, Math.floor(currentSwitches)) + 1;
  const shouldAutoSubmit = nextSwitches >= safeLimit;
  return {
    nextSwitches,
    maxWarnings: safeLimit,
    shouldLock: !shouldAutoSubmit,
    shouldAutoSubmit,
  };
}

export function changeUserPassword(
  users: User[],
  usernameOrId: string,
  currentPassword: string,
  newPassword: string,
  confirmPassword: string
): { updatedUsers?: User[]; updatedUser?: User; error?: string } {
  const cleanKey = usernameOrId.trim().toLowerCase();
  const cleanCurrent = currentPassword.trim();
  const cleanNew = newPassword.trim();
  const cleanConfirm = confirmPassword.trim();

  if (!cleanKey) {
    return { error: 'NIS / NIP / ID Pengguna wajib diisi.' };
  }
  if (!cleanCurrent || !cleanNew || !cleanConfirm) {
    return { error: 'Seluruh kolom kata sandi wajib diisi.' };
  }
  if (cleanNew.length < 3) {
    return { error: 'Kata sandi baru minimal 3 karakter.' };
  }
  if (cleanNew !== cleanConfirm) {
    return { error: 'Konfirmasi kata sandi baru tidak cocok.' };
  }

  const target = users.find(
    (u) =>
      u.id.toLowerCase() === cleanKey ||
      u.username.trim().toLowerCase() === cleanKey
  );
  if (!target) {
    return { error: 'Akun pengguna tidak ditemukan.' };
  }
  if (!target.active) {
    return { error: 'Akun ini sedang dinonaktifkan oleh Admin.' };
  }
  if (target.password !== cleanCurrent) {
    return { error: 'Kata sandi lama tidak sesuai.' };
  }

  const updatedUser: User = { ...target, password: cleanNew };
  const updatedUsers = users.map((u) => (u.id === target.id ? updatedUser : u));
  return { updatedUsers, updatedUser };
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

export const QUESTION_TYPE_LABELS: Record<Question['type'], string> = {
  pg: 'Pilihan Ganda',
  pg_kompleks: 'Pilihan Ganda Kompleks',
  benar_salah: 'Benar / Salah',
  menjodohkan: 'Menjodohkan',
  esai: 'Esai / Uraian',
};

export function isQuestionAnswered(
  question: Question,
  answer: QuestionAnswerValue | undefined
): boolean {
  if (answer === undefined || answer === null) return false;
  switch (question.type) {
    case 'pg':
      return typeof answer === 'number' && answer >= 0;
    case 'pg_kompleks':
      return Array.isArray(answer) && answer.length > 0;
    case 'benar_salah': {
      if (typeof answer !== 'object' || Array.isArray(answer)) return false;
      const statements = question.statements ?? [];
      if (statements.length === 0) return false;
      const record = answer as Record<number, boolean>;
      return statements.every((_, idx) => typeof record[idx] === 'boolean');
    }
    case 'menjodohkan': {
      if (typeof answer !== 'object' || Array.isArray(answer)) return false;
      const pairs = question.matchingPairs ?? [];
      if (pairs.length === 0) return false;
      const record = answer as Record<number, string>;
      return pairs.every(
        (_, idx) => typeof record[idx] === 'string' && record[idx].trim().length > 0
      );
    }
    case 'esai':
    default:
      return typeof answer === 'string' && answer.trim().length > 0;
  }
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
  answers: Record<string, QuestionAnswerValue>,
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
    const studentAns = answers[question.id];

    if (question.type === 'pg') {
      pgTotalCount += 1;
      if (
        typeof studentAns === 'number' &&
        studentAns === question.correctOptionIndex
      ) {
        autoScore += pts;
        pgCorrectCount += 1;
      }
    } else if (question.type === 'pg_kompleks') {
      pgTotalCount += 1;
      const correctIndices = question.correctOptionIndices ?? [];
      if (Array.isArray(studentAns) && correctIndices.length > 0) {
        const correctSet = new Set(correctIndices);
        const uniqueSelected = Array.from(new Set(studentAns));
        let correctHits = 0;
        let wrongHits = 0;
        for (const idx of uniqueSelected) {
          if (correctSet.has(idx)) correctHits += 1;
          else wrongHits += 1;
        }
        const ratio = Math.max(0, (correctHits - wrongHits) / correctSet.size);
        autoScore += Math.round(pts * ratio * 100) / 100;
        if (ratio === 1) pgCorrectCount += 1;
      }
    } else if (question.type === 'benar_salah') {
      pgTotalCount += 1;
      const statements = question.statements ?? [];
      if (
        statements.length > 0 &&
        studentAns &&
        typeof studentAns === 'object' &&
        !Array.isArray(studentAns)
      ) {
        const map = studentAns as Record<number, boolean>;
        let matched = 0;
        statements.forEach((st, idx) => {
          if (map[idx] === st.isTrue) matched += 1;
        });
        const ratio = matched / statements.length;
        autoScore += Math.round(pts * ratio * 100) / 100;
        if (matched === statements.length) pgCorrectCount += 1;
      }
    } else if (question.type === 'menjodohkan') {
      pgTotalCount += 1;
      const pairs = question.matchingPairs ?? [];
      if (
        pairs.length > 0 &&
        studentAns &&
        typeof studentAns === 'object' &&
        !Array.isArray(studentAns)
      ) {
        const map = studentAns as Record<number, string>;
        let matched = 0;
        pairs.forEach((pair, idx) => {
          if (
            typeof map[idx] === 'string' &&
            map[idx].trim().toLowerCase() === pair.right.trim().toLowerCase()
          ) {
            matched += 1;
          }
        });
        const ratio = matched / pairs.length;
        autoScore += Math.round(pts * ratio * 100) / 100;
        if (matched === pairs.length) pgCorrectCount += 1;
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

  autoScore = Math.round(autoScore * 100) / 100;
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
    'No. Peserta',
    'Nama Siswa',
    'Kelas',
    'Status',
    'Skor Otomatis',
    'Skor Esai',
    'Nilai Akhir (0-100)',
    'Pelanggaran Tab',
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
