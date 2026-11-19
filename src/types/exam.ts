export type UserRole = 'siswa' | 'guru' | 'admin';

export interface User {
  id: string;
  username: string;
  password: string;
  name: string;
  role: UserRole;
  kelas: string;
  mapel?: string;
  active: boolean;
  createdAt: string;
}

export type QuestionType = 'pg' | 'esai';
export type DifficultyLevel = 'Mudah' | 'Sedang' | 'Sulit';

export interface Question {
  id: string;
  subject: string;
  gradeLevel: '7' | '8' | '9';
  type: QuestionType;
  prompt: string;
  options?: string[];
  correctOptionIndex?: number;
  rubric?: string;
  points: number;
  difficulty: DifficultyLevel;
  createdBy: string;
  createdAt: string;
}

export type ExamStatus = 'draft' | 'terjadwal' | 'berlangsung' | 'selesai';

export interface Exam {
  id: string;
  title: string;
  subject: string;
  targetClass: string;
  gradeLevel: '7' | '8' | '9';
  teacherId: string;
  teacherName: string;
  durationMinutes: number;
  startTime: string;
  endTime: string;
  token: string;
  requireToken: boolean;
  shuffleQuestions: boolean;
  showResultToStudent: boolean;
  status: ExamStatus;
  questionIds: string[];
  room: string;
}

export type SessionStatus = 'sedang_mengerjakan' | 'selesai';

export interface ExamSubmission {
  id: string;
  examId: string;
  studentId: string;
  studentName: string;
  studentNis: string;
  studentClass: string;
  answers: Record<string, number | string>;
  flaggedIds: string[];
  essayScores: Record<string, number>;
  essayFeedback: Record<string, string>;
  autoScore: number;
  essayScoreTotal: number;
  finalScore: number;
  status: SessionStatus;
  tabSwitches: number;
  startedAt: string;
  submittedAt?: string;
  remainingSeconds: number;
}

export interface SystemSettings {
  schoolName: string;
  npsn: string;
  address: string;
  academicYear: string;
  semester: 'Ganjil' | 'Genap';
  defaultShuffle: boolean;
  defaultRequireToken: boolean;
  maxTabSwitchWarnings: number;
  allowStudentScorePreview: boolean;
  maintenanceMode: boolean;
  announcement: string;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  detail: string;
}

export interface AppDatabase {
  users: User[];
  questions: Question[];
  exams: Exam[];
  submissions: ExamSubmission[];
  settings: SystemSettings;
  activityLogs?: ActivityLog[];
}

export interface ScheduleConflict {
  examAId: string;
  examBId: string;
  reason: string;
}
