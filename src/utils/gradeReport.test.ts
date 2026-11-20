import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGradeReportWorkbook,
  filterStudentExamLogs,
  groupSubmissionsByClass,
} from './gradeReport';
import type { ActivityLog, Exam, ExamSubmission } from '../types/exam';

const sampleExams: Exam[] = [
  {
    id: 'ex-1',
    title: 'PAS IPA Kelas 9',
    subject: 'IPA',
    targetClass: 'Semua Kelas 9',
    gradeLevel: '9',
    teacherId: 'g1',
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
  },
];

const sampleSubs: ExamSubmission[] = [
  {
    id: 's1',
    examId: 'ex-1',
    studentId: 'u1',
    studentName: 'Budi',
    studentNis: '09-9B-01',
    studentClass: '9b',
    answers: {},
    flaggedIds: [],
    essayScores: {},
    essayFeedback: {},
    autoScore: 70,
    essayScoreTotal: 10,
    finalScore: 80,
    status: 'selesai',
    tabSwitches: 1,
    startedAt: '2026-11-19T08:00:00Z',
    submittedAt: '2026-11-19T08:30:00Z',
    remainingSeconds: 900,
  },
  {
    id: 's2',
    examId: 'ex-1',
    studentId: 'u2',
    studentName: 'Alya',
    studentNis: '09-9A-01',
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
    submittedAt: '2026-11-19T08:25:00Z',
    remainingSeconds: 1200,
  },
  {
    id: 's3',
    examId: 'ex-1',
    studentId: 'u3',
    studentName: 'Citra',
    studentNis: '09-9A-02',
    studentClass: '9A',
    answers: {},
    flaggedIds: [],
    essayScores: {},
    essayFeedback: {},
    autoScore: 60,
    essayScoreTotal: 0,
    finalScore: 60,
    status: 'selesai',
    tabSwitches: 2,
    startedAt: '2026-11-19T08:05:00Z',
    submittedAt: '2026-11-19T08:40:00Z',
    remainingSeconds: 600,
  },
];

const sampleLogs: ActivityLog[] = [
  {
    id: 'l1',
    timestamp: '2026-11-19T08:00:00Z',
    actorName: 'Alya',
    actorRole: 'siswa',
    action: 'Masuk Kode Ujian',
    detail: 'Memasuki PAS IPA',
    examId: 'ex-1',
    examTitle: 'PAS IPA Kelas 9',
    studentNis: '09-9A-01',
    studentClass: '9A',
  },
  {
    id: 'l2',
    timestamp: '2026-11-19T08:05:00Z',
    actorName: 'Admin',
    actorRole: 'admin',
    action: 'Ubah Konfigurasi',
    detail: 'Mengubah logo',
  },
];

test('groupSubmissionsByClass groups, sorts classes and computes accurate averages', () => {
  const groups = groupSubmissionsByClass(sampleSubs, 'ex-1');
  assert.equal(groups.length, 2);
  assert.equal(groups[0].kelas, '9A');
  assert.equal(groups[0].totalParticipants, 2);
  assert.equal(groups[0].averageScore, 75);
  assert.equal(groups[0].highestScore, 90);
  assert.equal(groups[0].lowestScore, 60);
  assert.equal(groups[0].totalTabViolations, 2);

  assert.equal(groups[1].kelas, '9B');
  assert.equal(groups[1].averageScore, 80);
});

test('filterStudentExamLogs scopes strictly to student exam activities', () => {
  const filtered = filterStudentExamLogs(sampleLogs, {
    examId: 'ex-1',
    kelas: '9A',
  });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].actorName, 'Alya');
});

test('buildGradeReportWorkbook creates multi-sheet Excel workbook per class and logs', () => {
  const wb = buildGradeReportWorkbook(
    sampleExams,
    sampleSubs,
    sampleLogs,
    'ex-1'
  );
  assert.deepEqual(wb.SheetNames, [
    'Rekap Per Kelas',
    'Semua Hasil Nilai',
    'Kelas 9A',
    'Kelas 9B',
    'Log Pengerjaan Siswa',
  ]);
});
