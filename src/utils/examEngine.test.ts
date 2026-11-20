import test from 'node:test';
import assert from 'node:assert/strict';
import {
  authenticateUser,
  authenticateUserForRole,
  canAccessTab,
  changeUserPassword,
  detectScheduleConflicts,
  evaluateTabSwitchViolation,
  exportSubmissionsToCsv,
  filterExamsForTeacher,
  filterLogsForTeacher,
  filterQuestionsForTeacher,
  filterSubmissionsForTeacher,
  findExamByCode,
  formatCountdown,
  gradeSubmission,
  isClassEligibleForExam,
  isQuestionAnswered,
  isTeacherSubjectMatch,
  lookupRegisteredParticipantForExam,
  resolveParticipantForExam,
  resolveStudentForExamCode,
  validateExamToken,
} from './examEngine';
import type { ActivityLog, Exam, ExamSubmission, Question, User } from '../types/exam';

const sampleUsers: User[] = [
  {
    id: 'u1',
    username: '240901',
    password: 'pw1',
    name: 'Alya Putri',
    role: 'siswa',
    kelas: '9A',
    active: true,
    createdAt: '2026-08-01T00:00:00Z',
  },
  {
    id: 'u2',
    username: 'guru.ipa',
    password: 'pw2',
    name: 'Ibu Siti',
    role: 'guru',
    kelas: '-',
    mapel: 'IPA',
    active: true,
    createdAt: '2026-08-01T00:00:00Z',
  },
  {
    id: 'u3',
    username: 'nonaktif',
    password: 'pw3',
    name: 'User Nonaktif',
    role: 'siswa',
    kelas: '9B',
    active: false,
    createdAt: '2026-08-01T00:00:00Z',
  },
];

test('RBAC restricts tabs strictly per role', () => {
  assert.equal(canAccessTab('siswa', 'siswa-ujian'), true);
  assert.equal(canAccessTab('siswa', 'guru-soal'), false);
  assert.equal(canAccessTab('siswa', 'admin-pengguna'), false);

  assert.equal(canAccessTab('guru', 'guru-nilai'), true);
  assert.equal(canAccessTab('guru', 'admin-sistem'), false);

  assert.equal(canAccessTab('admin', 'admin-jadwal'), true);
  assert.equal(canAccessTab('admin', 'siswa-ujian'), false);
});

test('authenticateUser validates credentials and active flag', () => {
  const emptyResult = authenticateUser(sampleUsers, '', 'pw1');
  assert.ok(emptyResult.error);

  const wrongPass = authenticateUser(sampleUsers, '240901', 'salah');
  assert.ok(wrongPass.error);

  const inactive = authenticateUser(sampleUsers, 'nonaktif', 'pw3');
  assert.ok(inactive.error);

  const valid = authenticateUser(sampleUsers, '240901', 'pw1');
  assert.equal(valid.user?.id, 'u1');
});

test('isClassEligibleForExam matches exact and grade-wide classes', () => {
  assert.equal(isClassEligibleForExam('9A', '9A'), true);
  assert.equal(isClassEligibleForExam('9B', 'Semua Kelas 9'), true);
  assert.equal(isClassEligibleForExam('8A', 'Semua Kelas 9'), false);
  assert.equal(isClassEligibleForExam('9B', '9A, 9B'), true);
});

test('gradeSubmission scores PG and Essay accurately on a 0-100 scale', () => {
  const questions: Question[] = [
    {
      id: 'q1',
      subject: 'Matematika',
      gradeLevel: '9',
      type: 'pg',
      prompt: '2 + 2 = ?',
      options: ['3', '4', '5', '6'],
      correctOptionIndex: 1,
      points: 20,
      difficulty: 'Mudah',
      createdBy: 'u2',
      createdAt: '2026-08-01T00:00:00Z',
    },
    {
      id: 'q2',
      subject: 'Matematika',
      gradeLevel: '9',
      type: 'esai',
      prompt: 'Jelaskan teorema Pythagoras.',
      points: 30,
      difficulty: 'Sedang',
      createdBy: 'u2',
      createdAt: '2026-08-01T00:00:00Z',
    },
  ];

  const beforeEssay = gradeSubmission(questions, { q1: 1, q2: 'a^2 + b^2 = c^2' });
  assert.equal(beforeEssay.autoScore, 20);
  assert.equal(beforeEssay.hasPendingEssay, true);
  assert.equal(beforeEssay.finalScore, 40);

  const afterEssay = gradeSubmission(
    questions,
    { q1: 1, q2: 'a^2 + b^2 = c^2' },
    { q2: 25 }
  );
  assert.equal(afterEssay.hasPendingEssay, false);
  assert.equal(afterEssay.essayScoreTotal, 25);
  assert.equal(afterEssay.finalScore, 90);
});

test('validateExamToken checks token when enabled locally or globally', () => {
  const exam: Exam = {
    id: 'e1',
    title: 'UAS IPA',
    subject: 'IPA',
    targetClass: '9A',
    gradeLevel: '9',
    teacherId: 'u2',
    teacherName: 'Ibu Siti',
    durationMinutes: 45,
    startTime: '2026-11-19T08:00:00Z',
    endTime: '2026-11-19T09:00:00Z',
    token: 'KRT9A1',
    requireToken: true,
    shuffleQuestions: false,
    showResultToStudent: true,
    status: 'berlangsung',
    questionIds: [],
    room: 'Lab CBT 1',
  };

  assert.equal(validateExamToken(exam, 'krt9a1', false).valid, true);
  assert.equal(validateExamToken(exam, 'SALAH', false).valid, false);
  assert.equal(validateExamToken({ ...exam, requireToken: false }, '', false).valid, true);
  assert.equal(validateExamToken({ ...exam, requireToken: false }, '', true).valid, false);
});

test('detectScheduleConflicts flags overlapping class or room schedules', () => {
  const base: Exam = {
    id: 'e1',
    title: 'Ujian A',
    subject: 'Matematika',
    targetClass: 'Semua Kelas 9',
    gradeLevel: '9',
    teacherId: 'u2',
    teacherName: 'Guru A',
    durationMinutes: 60,
    startTime: '2026-11-20T08:00:00',
    endTime: '2026-11-20T09:00:00',
    token: 'AAA111',
    requireToken: false,
    shuffleQuestions: false,
    showResultToStudent: true,
    status: 'terjadwal',
    questionIds: [],
    room: 'Lab 1',
  };

  const overlapping: Exam = {
    ...base,
    id: 'e2',
    title: 'Ujian B',
    targetClass: '9A',
    startTime: '2026-11-20T08:30:00',
    endTime: '2026-11-20T09:30:00',
    room: 'Lab 2',
  };

  const separate: Exam = {
    ...base,
    id: 'e3',
    title: 'Ujian C',
    targetClass: '8A',
    startTime: '2026-11-20T10:00:00',
    endTime: '2026-11-20T11:00:00',
    room: 'Lab 1',
  };

  const conflicts = detectScheduleConflicts([base, overlapping, separate]);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].examAId, 'e1');
  assert.equal(conflicts[0].examBId, 'e2');
});

test('formatCountdown and CSV export format cleanly', () => {
  assert.equal(formatCountdown(65), '01:05');
  assert.equal(formatCountdown(3661), '01:01:01');
  assert.equal(formatCountdown(-5), '00:00');

  const exam: Exam = {
    id: 'e1',
    title: 'Ujian IPA',
    subject: 'IPA',
    targetClass: '9A',
    gradeLevel: '9',
    teacherId: 'u2',
    teacherName: 'Ibu Siti',
    durationMinutes: 45,
    startTime: '2026-11-19T08:00:00Z',
    endTime: '2026-11-19T09:00:00Z',
    token: 'ABC123',
    requireToken: false,
    shuffleQuestions: false,
    showResultToStudent: true,
    status: 'selesai',
    questionIds: [],
    room: 'Lab 1',
  };

  const subs: ExamSubmission[] = [
    {
      id: 's1',
      examId: 'e1',
      studentId: 'u1',
      studentName: 'Alya, Putri',
      studentNis: '240901',
      studentClass: '9A',
      answers: {},
      flaggedIds: [],
      essayScores: {},
      essayFeedback: {},
      autoScore: 80,
      essayScoreTotal: 15,
      finalScore: 95,
      status: 'selesai',
      tabSwitches: 0,
      startedAt: '2026-11-19T08:00:00Z',
      submittedAt: '2026-11-19T08:30:00Z',
      remainingSeconds: 900,
    },
  ];

  const csv = exportSubmissionsToCsv(exam, subs);
  assert.match(csv, /"Alya, Putri"/);
  assert.match(csv, /95/);
});

test('authenticateUserForRole enforces strict role portal boundaries', () => {
  const wrongRole = authenticateUserForRole(sampleUsers, 'guru.ipa', 'pw2', 'admin');
  assert.ok(wrongRole.error);
  assert.match(wrongRole.error!, /Portal Guru/);

  const okRole = authenticateUserForRole(sampleUsers, 'guru.ipa', 'pw2', 'guru');
  assert.equal(okRole.user?.id, 'u2');
});

test('findExamByCode and resolveStudentForExamCode support passwordless exam code entry', () => {
  const exams: Exam[] = [
    {
      id: 'ex-active',
      title: 'PAS Matematika',
      subject: 'Matematika',
      targetClass: 'Semua Kelas 9',
      gradeLevel: '9',
      teacherId: 'u2',
      teacherName: 'Guru',
      durationMinutes: 45,
      startTime: '2026-11-19T08:00',
      endTime: '2026-11-19T12:00',
      token: 'KRT9M1',
      requireToken: true,
      shuffleQuestions: false,
      showResultToStudent: true,
      status: 'berlangsung',
      questionIds: [],
      room: 'Lab 1',
    },
    {
      id: 'ex-sched',
      title: 'Simulasi',
      subject: 'IPA',
      targetClass: '9A',
      gradeLevel: '9',
      teacherId: 'u2',
      teacherName: 'Guru',
      durationMinutes: 30,
      startTime: '2026-11-22T08:00',
      endTime: '2026-11-22T09:00',
      token: 'SIM001',
      requireToken: true,
      shuffleQuestions: false,
      showResultToStudent: true,
      status: 'terjadwal',
      questionIds: [],
      room: 'Lab 2',
    },
  ];

  const missing = findExamByCode(exams, '');
  assert.ok(missing.error);

  const scheduled = findExamByCode(exams, 'sim001');
  assert.ok(scheduled.error);

  const active = findExamByCode(exams, 'krt9m1');
  assert.equal(active.exam?.id, 'ex-active');

  // Unregistered guest / blank number must be rejected strictly
  const emptyStudent = resolveStudentForExamCode(sampleUsers, active.exam!);
  assert.ok(emptyStudent.error);

  const unregisteredStudent = resolveStudentForExamCode(sampleUsers, active.exam!, '999999');
  assert.ok(unregisteredStudent.error);
  assert.match(unregisteredStudent.error!, /tidak terdaftar/i);

  const matchedStudent = resolveStudentForExamCode(sampleUsers, active.exam!, '240901');
  assert.equal(matchedStudent.student?.id, 'u1');

  // Auto-fill lookup from Manajemen Data Pengguna
  const lookupEmpty = lookupRegisteredParticipantForExam(sampleUsers, active.exam!, '');
  assert.equal(lookupEmpty.status, 'empty');

  const lookupUnknown = lookupRegisteredParticipantForExam(sampleUsers, active.exam!, '000111');
  assert.equal(lookupUnknown.status, 'not_found');
  assert.equal(lookupUnknown.student, undefined);

  const lookupInactive = lookupRegisteredParticipantForExam(sampleUsers, active.exam!, 'nonaktif');
  assert.equal(lookupInactive.status, 'inactive');

  const lookupValid = lookupRegisteredParticipantForExam(sampleUsers, active.exam!, '240901');
  assert.equal(lookupValid.status, 'valid');
  assert.equal(lookupValid.student?.name, 'Alya Putri');
  assert.equal(lookupValid.student?.kelas, '9A');

  const missingIdentity = resolveParticipantForExam(sampleUsers, active.exam!, {
    name: '',
    kelas: '9A',
    participantNumber: '240901',
  });
  assert.ok(missingIdentity.error);

  const unregisteredParticipant = resolveParticipantForExam(sampleUsers, active.exam!, {
    name: 'Bima Pratama',
    kelas: '9B',
    participantNumber: '09-9B-015',
  });
  assert.ok(unregisteredParticipant.error);
  assert.match(unregisteredParticipant.error!, /tidak terdaftar/i);

  const validParticipant = resolveParticipantForExam(sampleUsers, active.exam!, {
    name: 'Alya Putri',
    kelas: '9a',
    participantNumber: '240901',
  });
  assert.equal(validParticipant.student?.name, 'Alya Putri');
  assert.equal(validParticipant.student?.kelas, '9A');
  assert.equal(validParticipant.student?.username, '240901');
});

test('evaluateTabSwitchViolation locks on 1st and 2nd violation and auto-submits on 3rd', () => {
  const strike1 = evaluateTabSwitchViolation(0, 3);
  assert.equal(strike1.nextSwitches, 1);
  assert.equal(strike1.shouldLock, true);
  assert.equal(strike1.shouldAutoSubmit, false);

  const strike2 = evaluateTabSwitchViolation(1, 3);
  assert.equal(strike2.nextSwitches, 2);
  assert.equal(strike2.shouldLock, true);
  assert.equal(strike2.shouldAutoSubmit, false);

  const strike3 = evaluateTabSwitchViolation(2, 3);
  assert.equal(strike3.nextSwitches, 3);
  assert.equal(strike3.shouldLock, false);
  assert.equal(strike3.shouldAutoSubmit, true);
});

test('changeUserPassword validates old password, confirmation, and updates user record', () => {
  const wrongOld = changeUserPassword(sampleUsers, 'guru.ipa', 'salah', 'baru123', 'baru123');
  assert.ok(wrongOld.error);

  const mismatch = changeUserPassword(sampleUsers, 'guru.ipa', 'pw2', 'baru123', 'beda123');
  assert.ok(mismatch.error);

  const shortPass = changeUserPassword(sampleUsers, 'guru.ipa', 'pw2', 'ab', 'ab');
  assert.ok(shortPass.error);

  const success = changeUserPassword(sampleUsers, 'guru.ipa', 'pw2', 'baru123', 'baru123');
  assert.equal(success.updatedUser?.password, 'baru123');
  assert.equal(success.updatedUsers?.find((u) => u.id === 'u2')?.password, 'baru123');
});

test('admin-laporan RBAC is restricted to admin only', () => {
  assert.equal(canAccessTab('admin', 'admin-laporan'), true);
  assert.equal(canAccessTab('guru', 'admin-laporan'), false);
  assert.equal(canAccessTab('siswa', 'admin-laporan'), false);
});

test('gradeSubmission and isQuestionAnswered handle all 5 question types accurately', () => {
  const mixedQuestions: Question[] = [
    {
      id: 'q-pg',
      subject: 'IPA',
      gradeLevel: '9',
      type: 'pg',
      prompt: 'PG',
      options: ['A', 'B', 'C', 'D'],
      correctOptionIndex: 1,
      points: 20,
      difficulty: 'Mudah',
      createdBy: 'u2',
      createdAt: '2026-08-01T00:00:00Z',
    },
    {
      id: 'q-pgk',
      subject: 'IPA',
      gradeLevel: '9',
      type: 'pg_kompleks',
      prompt: 'PG Kompleks',
      options: ['A', 'B', 'C', 'D'],
      correctOptionIndices: [0, 2],
      points: 20,
      difficulty: 'Sedang',
      createdBy: 'u2',
      createdAt: '2026-08-01T00:00:00Z',
    },
    {
      id: 'q-bs',
      subject: 'IPA',
      gradeLevel: '9',
      type: 'benar_salah',
      prompt: 'Benar Salah',
      statements: [
        { text: 'S1', isTrue: true },
        { text: 'S2', isTrue: false },
      ],
      points: 20,
      difficulty: 'Sedang',
      createdBy: 'u2',
      createdAt: '2026-08-01T00:00:00Z',
    },
    {
      id: 'q-jodoh',
      subject: 'IPA',
      gradeLevel: '9',
      type: 'menjodohkan',
      prompt: 'Menjodohkan',
      matchingPairs: [
        { left: 'Volt', right: 'Tegangan' },
        { left: 'Ampere', right: 'Arus' },
      ],
      points: 20,
      difficulty: 'Sedang',
      createdBy: 'u2',
      createdAt: '2026-08-01T00:00:00Z',
    },
    {
      id: 'q-esai',
      subject: 'IPA',
      gradeLevel: '9',
      type: 'esai',
      prompt: 'Esai',
      points: 20,
      difficulty: 'Sulit',
      createdBy: 'u2',
      createdAt: '2026-08-01T00:00:00Z',
    },
  ];

  const answers = {
    'q-pg': 1, // 20/20
    'q-pgk': [0, 2], // 20/20
    'q-bs': { 0: true, 1: true }, // 1/2 matched => 10/20
    'q-jodoh': { 0: 'Tegangan', 1: 'Arus' }, // 20/20
    'q-esai': 'Jawaban uraian lengkap',
  };

  assert.equal(isQuestionAnswered(mixedQuestions[0], answers['q-pg']), true);
  assert.equal(isQuestionAnswered(mixedQuestions[1], answers['q-pgk']), true);
  assert.equal(isQuestionAnswered(mixedQuestions[1], []), false);
  assert.equal(isQuestionAnswered(mixedQuestions[2], answers['q-bs']), true);
  assert.equal(isQuestionAnswered(mixedQuestions[2], { 0: true }), false);
  assert.equal(isQuestionAnswered(mixedQuestions[3], answers['q-jodoh']), true);
  assert.equal(isQuestionAnswered(mixedQuestions[3], { 0: 'Tegangan' }), false);
  assert.equal(isQuestionAnswered(mixedQuestions[4], answers['q-esai']), true);

  const graded = gradeSubmission(mixedQuestions, answers, { 'q-esai': 15 });
  assert.equal(graded.autoScore, 70);
  assert.equal(graded.essayScoreTotal, 15);
  assert.equal(graded.finalScore, 85);
  assert.equal(graded.hasPendingEssay, false);

  // Wrong picks on pg_kompleks penalize to minimum 0
  const penalty = gradeSubmission(
    [mixedQuestions[1]],
    { 'q-pgk': [1, 3] },
    {}
  );
  assert.equal(penalty.autoScore, 0);
});

test('resolveParticipantForExam strictly blocks duplicate participant number or name once finished', () => {
  const registeredUsers: User[] = [
    ...sampleUsers,
    {
      id: 'u4',
      username: '09-9A-01',
      password: '123',
      name: 'Bima Pratama',
      role: 'siswa',
      kelas: '9A',
      active: true,
      createdAt: '2026-08-01T00:00:00Z',
    },
    {
      id: 'u5',
      username: '09-9A-99',
      password: '123',
      name: 'Bima Pratama',
      role: 'siswa',
      kelas: '9A',
      active: true,
      createdAt: '2026-08-01T00:00:00Z',
    },
    {
      id: 'u6',
      username: '09-9B-02',
      password: '123',
      name: 'Sari Dewi',
      role: 'siswa',
      kelas: '9B',
      active: true,
      createdAt: '2026-08-01T00:00:00Z',
    },
    {
      id: 'u7',
      username: '240801',
      password: '123',
      name: 'Dimas Kelas 8',
      role: 'siswa',
      kelas: '8A',
      active: true,
      createdAt: '2026-08-01T00:00:00Z',
    },
  ];

  const exam: Exam = {
    id: 'ex-1',
    title: 'PAS IPA',
    subject: 'IPA',
    targetClass: 'Semua Kelas 9',
    gradeLevel: '9',
    teacherId: 'u2',
    teacherName: 'Ibu Siti',
    durationMinutes: 45,
    startTime: '2026-11-19T08:00',
    endTime: '2026-11-19T12:00',
    token: 'IPA9B2',
    requireToken: true,
    shuffleQuestions: false,
    showResultToStudent: true,
    status: 'berlangsung',
    questionIds: [],
    room: 'Lab 1',
  };

  const subs: ExamSubmission[] = [
    {
      id: 'sub-done',
      examId: 'ex-1',
      studentId: 'u4',
      studentName: 'Bima Pratama',
      studentNis: '09-9A-01',
      studentClass: '9A',
      answers: {},
      flaggedIds: [],
      essayScores: {},
      essayFeedback: {},
      autoScore: 80,
      essayScoreTotal: 0,
      finalScore: 80,
      status: 'selesai',
      tabSwitches: 0,
      startedAt: '2026-11-19T08:00:00Z',
      submittedAt: '2026-11-19T08:25:00Z',
      remainingSeconds: 600,
    },
    {
      id: 'sub-active',
      examId: 'ex-1',
      studentId: 'u6',
      studentName: 'Sari Dewi',
      studentNis: '09-9B-02',
      studentClass: '9B',
      answers: {},
      flaggedIds: [],
      essayScores: {},
      essayFeedback: {},
      autoScore: 0,
      essayScoreTotal: 0,
      finalScore: 0,
      status: 'sedang_mengerjakan',
      tabSwitches: 0,
      startedAt: '2026-11-19T08:10:00Z',
      remainingSeconds: 1800,
    },
  ];

  // Wrong grade/class from registered list -> blocked
  const wrongClass = resolveParticipantForExam(
    registeredUsers,
    exam,
    { name: 'Dimas Kelas 8', kelas: '8A', participantNumber: '240801' },
    subs
  );
  assert.ok(wrongClass.error);

  // Same participant number on finished exam -> blocked
  const dupNumber = resolveParticipantForExam(
    registeredUsers,
    exam,
    { name: 'Bima Pratama', kelas: '9A', participantNumber: '09-9a-01' },
    subs
  );
  assert.ok(dupNumber.error);
  assert.match(dupNumber.error!, /1 kali/);

  // Same name with different number on finished exam -> blocked
  const dupName = resolveParticipantForExam(
    registeredUsers,
    exam,
    { name: 'Bima Pratama', kelas: '9A', participantNumber: '09-9A-99' },
    subs
  );
  assert.ok(dupName.error);
  assert.match(dupName.error!, /1 kali/);

  // Spoofed name for active session -> blocked
  const hijackActive = resolveParticipantForExam(
    registeredUsers,
    exam,
    { name: 'Bukan Sari', kelas: '9B', participantNumber: '09-9B-02' },
    subs
  );
  assert.ok(hijackActive.error);

  // Resuming own active session with matching registered data -> allowed
  const resumeOwn = resolveParticipantForExam(
    registeredUsers,
    exam,
    { name: 'Sari Dewi', kelas: '9B', participantNumber: '09-9B-02' },
    subs
  );
  assert.ok(resumeOwn.student);
  assert.equal(resumeOwn.student?.username, '09-9B-02');
});

test('admin-kartu RBAC and per-subject teacher access control isolate Bank Soal, Nilai, and Logs', () => {
  assert.equal(canAccessTab('admin', 'admin-kartu'), true);
  assert.equal(canAccessTab('guru', 'admin-kartu'), false);
  assert.equal(canAccessTab('siswa', 'admin-kartu'), false);

  assert.equal(isTeacherSubjectMatch('IPA Terpadu', 'IPA Terpadu'), true);
  assert.equal(isTeacherSubjectMatch('IPA Terpadu', 'IPA'), true);
  assert.equal(isTeacherSubjectMatch('IPA', 'IPA Terpadu'), true);
  assert.equal(isTeacherSubjectMatch('IPA Terpadu', 'Matematika'), false);
  assert.equal(isTeacherSubjectMatch('IPA Terpadu', 'Bahasa Indonesia'), false);
  assert.equal(isTeacherSubjectMatch('Bahasa Indonesia', 'Bahasa Inggris'), false);

  const guruIpa: User = {
    id: 'u-ipa',
    username: 'guru.ipa',
    password: '123',
    name: 'Siti Rahmawati',
    role: 'guru',
    kelas: '-',
    mapel: 'IPA Terpadu',
    active: true,
    createdAt: '2026-08-01T00:00:00Z',
  };

  const questions: Question[] = [
    {
      id: 'q-ipa',
      subject: 'IPA Terpadu',
      gradeLevel: '9',
      type: 'pg',
      prompt: 'Soal IPA',
      options: ['A', 'B', 'C', 'D'],
      correctOptionIndex: 0,
      points: 20,
      difficulty: 'Mudah',
      createdBy: 'u-ipa',
      createdAt: '2026-08-01T00:00:00Z',
    },
    {
      id: 'q-mtk',
      subject: 'Matematika',
      gradeLevel: '9',
      type: 'pg',
      prompt: 'Soal MTK',
      options: ['A', 'B', 'C', 'D'],
      correctOptionIndex: 0,
      points: 20,
      difficulty: 'Mudah',
      createdBy: 'u-mtk',
      createdAt: '2026-08-01T00:00:00Z',
    },
    {
      id: 'q-bind',
      subject: 'Bahasa Indonesia',
      gradeLevel: '9',
      type: 'pg',
      prompt: 'Soal Bahasa Indonesia',
      options: ['A', 'B', 'C', 'D'],
      correctOptionIndex: 0,
      points: 20,
      difficulty: 'Mudah',
      createdBy: 'u-ipa',
      createdAt: '2026-08-01T00:00:00Z',
    },
  ];

  const scopedQs = filterQuestionsForTeacher(questions, guruIpa);
  assert.deepEqual(
    scopedQs.map((q) => q.id),
    ['q-ipa']
  );

  const exams: Exam[] = [
    {
      id: 'ex-ipa',
      title: 'UTS IPA',
      subject: 'IPA Terpadu',
      targetClass: '9A',
      gradeLevel: '9',
      teacherId: 'u-ipa',
      teacherName: 'Siti Rahmawati',
      durationMinutes: 30,
      startTime: '2026-11-19T08:00',
      endTime: '2026-11-19T09:00',
      token: 'IPA1',
      requireToken: true,
      shuffleQuestions: false,
      showResultToStudent: true,
      status: 'berlangsung',
      questionIds: ['q-ipa'],
      room: 'Lab 2',
    },
    {
      id: 'ex-mtk',
      title: 'PAS MTK',
      subject: 'Matematika',
      targetClass: '9A',
      gradeLevel: '9',
      teacherId: 'u-mtk',
      teacherName: 'Budi',
      durationMinutes: 45,
      startTime: '2026-11-19T08:00',
      endTime: '2026-11-19T09:00',
      token: 'MTK1',
      requireToken: true,
      shuffleQuestions: false,
      showResultToStudent: true,
      status: 'berlangsung',
      questionIds: ['q-mtk'],
      room: 'Lab 1',
    },
  ];

  const scopedEx = filterExamsForTeacher(exams, guruIpa);
  assert.deepEqual(
    scopedEx.map((e) => e.id),
    ['ex-ipa']
  );

  const subs: ExamSubmission[] = [
    {
      id: 'sub-ipa',
      examId: 'ex-ipa',
      studentId: 'u1',
      studentName: 'Alya',
      studentNis: '240901',
      studentClass: '9A',
      answers: {},
      flaggedIds: [],
      essayScores: {},
      essayFeedback: {},
      autoScore: 90,
      essayScoreTotal: 0,
      finalScore: 90,
      status: 'selesai',
      tabSwitches: 0,
      startedAt: '2026-11-19T08:00:00Z',
      remainingSeconds: 100,
    },
    {
      id: 'sub-mtk',
      examId: 'ex-mtk',
      studentId: 'u1',
      studentName: 'Alya',
      studentNis: '240901',
      studentClass: '9A',
      answers: {},
      flaggedIds: [],
      essayScores: {},
      essayFeedback: {},
      autoScore: 80,
      essayScoreTotal: 0,
      finalScore: 80,
      status: 'selesai',
      tabSwitches: 0,
      startedAt: '2026-11-19T08:00:00Z',
      remainingSeconds: 100,
    },
  ];

  const scopedSubs = filterSubmissionsForTeacher(subs, scopedEx);
  assert.deepEqual(
    scopedSubs.map((s) => s.id),
    ['sub-ipa']
  );

  const logs: ActivityLog[] = [
    {
      id: 'l-ipa',
      timestamp: '2026-11-19T08:01:00Z',
      actorName: 'Alya',
      actorRole: 'siswa',
      action: 'Mulai Ujian',
      detail: 'Mulai IPA',
      examId: 'ex-ipa',
    },
    {
      id: 'l-mtk',
      timestamp: '2026-11-19T08:02:00Z',
      actorName: 'Alya',
      actorRole: 'siswa',
      action: 'Mulai Ujian',
      detail: 'Mulai MTK',
      examId: 'ex-mtk',
    },
  ];

  const scopedLogs = filterLogsForTeacher(logs, scopedEx, guruIpa);
  assert.deepEqual(
    scopedLogs.map((l) => l.id),
    ['l-ipa']
  );
});

