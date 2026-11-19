import test from 'node:test';
import assert from 'node:assert/strict';
import {
  authenticateUser,
  canAccessTab,
  detectScheduleConflicts,
  exportSubmissionsToCsv,
  formatCountdown,
  gradeSubmission,
  isClassEligibleForExam,
  validateExamToken,
} from './examEngine';
import type { Exam, ExamSubmission, Question, User } from '../types/exam';

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
