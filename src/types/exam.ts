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

export type QuestionType =
  | 'pg'
  | 'pg_kompleks'
  | 'benar_salah'
  | 'menjodohkan'
  | 'esai';

export type DifficultyLevel = 'Mudah' | 'Sedang' | 'Sulit';

export type QuestionMediaType = 'image' | 'audio' | 'video';

export interface QuestionMedia {
  type: QuestionMediaType;
  url: string;
  name?: string;
}

export interface TrueFalseStatement {
  text: string;
  isTrue: boolean;
}

export interface MatchingPair {
  left: string;
  right: string;
}

export interface Question {
  id: string;
  subject: string;
  gradeLevel: '7' | '8' | '9';
  type: QuestionType;
  prompt: string;
  media?: QuestionMedia;
  options?: string[];
  correctOptionIndex?: number;
  correctOptionIndices?: number[];
  statements?: TrueFalseStatement[];
  matchingPairs?: MatchingPair[];
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

export type QuestionAnswerValue =
  | number
  | string
  | number[]
  | Record<number, boolean>
  | Record<number, string>;

export interface ExamSubmission {
  id: string;
  examId: string;
  studentId: string;
  studentName: string;
  studentNis: string;
  studentClass: string;
  answers: Record<string, QuestionAnswerValue>;
  flaggedIds: string[];
  essayScores: Record<string, number>;
  essayFeedback: Record<string, string>;
  autoScore: number;
  essayScoreTotal: number;
  finalScore: number;
  status: SessionStatus;
  tabSwitches: number;
  autoSubmittedReason?: string;
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
  announcementTitle?: string;
  announcement: string;
  logoUrl?: string;
  heroImageUrl?: string;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  detail: string;
  examId?: string;
  examTitle?: string;
  studentNis?: string;
  studentClass?: string;
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
