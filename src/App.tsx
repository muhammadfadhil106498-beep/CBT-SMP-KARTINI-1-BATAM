import { useEffect, useMemo, useState } from 'react';
import { AdminPortal } from './components/AdminPortal';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { ExamRunner } from './components/ExamRunner';
import { LoginView } from './components/LoginView';
import { StudentIdentityGate } from './components/StudentIdentityGate';
import { StudentPortal } from './components/StudentPortal';
import { TeacherPortal } from './components/TeacherPortal';
import { TopBar } from './components/TopBar';
import { SEED_DATABASE } from './data/seedData';
import {
  BackendCapabilities,
  getSavedSessionUserId,
  loadDatabase,
  persistDatabase,
  resetDatabase,
  saveSessionUserId,
} from './services/storage';
import type {
  ActivityLog,
  AppDatabase,
  Exam,
  ExamSubmission,
  Question,
  SystemSettings,
  User,
} from './types/exam';
import {
  canAccessTab,
  getDefaultTabForRole,
  gradeSubmission,
  isTeacherSubjectMatch,
  PortalTab,
} from './utils/examEngine';

export default function App() {
  const [database, setDatabase] = useState<AppDatabase>(() =>
    structuredClone(SEED_DATABASE)
  );
  const [capabilities, setCapabilities] = useState<BackendCapabilities>({
    mode: 'static',
    aiAvailable: false,
  });
  const [ready, setReady] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(() =>
    getSavedSessionUserId()
  );
  const [guestStudent, setGuestStudent] = useState<User | null>(null);
  const [pendingStudentExam, setPendingStudentExam] = useState<Exam | null>(null);
  const [activeTab, setActiveTab] = useState<PortalTab>('siswa-ujian');
  const [activeExamId, setActiveExamId] = useState<string | null>(null);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);

  useEffect(() => {
    let mounted = true;
    loadDatabase().then(({ db, capabilities: caps }) => {
      if (!mounted) return;
      setDatabase(db);
      setCapabilities(caps);
      const savedId = getSavedSessionUserId();
      if (savedId) {
        const found = db.users.find((u) => u.id === savedId && u.active);
        if (found) {
          setCurrentUserId(found.id);
          setActiveTab(getDefaultTabForRole(found.role));
        } else {
          saveSessionUserId(null);
          setCurrentUserId(null);
        }
      }
      setReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const currentUser = useMemo(() => {
    if (!currentUserId) return null;
    const registered = database.users.find(
      (u) => u.id === currentUserId && u.active
    );
    if (registered) return registered;
    if (guestStudent && guestStudent.id === currentUserId) return guestStudent;
    return null;
  }, [database.users, currentUserId, guestStudent]);

  const commitDatabase = (
    updater: (prev: AppDatabase) => AppDatabase,
    logEntry?: Omit<ActivityLog, 'id' | 'timestamp'>
  ) => {
    setDatabase((prev) => {
      const next = updater(prev);
      if (logEntry) {
        const entry: ActivityLog = {
          id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: new Date().toISOString(),
          ...logEntry,
        };
        next.activityLogs = [entry, ...(next.activityLogs ?? [])].slice(0, 100);
      }
      persistDatabase(next, capabilities);
      return next;
    });
  };

  const handleLoginSuccess = (user: User) => {
    setGuestStudent(null);
    setCurrentUserId(user.id);
    saveSessionUserId(user.id);
    setActiveTab(getDefaultTabForRole(user.role));
    setActiveExamId(null);
    commitDatabase((prev) => prev, {
      actorName: user.name,
      actorRole: user.role,
      action: 'Login',
      detail: `Masuk ke portal sebagai ${user.role.toUpperCase()}`,
    });
  };

  const handleStudentExamEnter = (exam: Exam, student: User) => {
    const normNumber = student.username.trim().toLowerCase();
    const normName = student.name.trim().toLowerCase().replace(/\s+/g, ' ');
    const completedDuplicate = database.submissions.find(
      (s) =>
        s.examId === exam.id &&
        s.status === 'selesai' &&
        (s.studentNis.trim().toLowerCase() === normNumber ||
          s.studentName.trim().toLowerCase().replace(/\s+/g, ' ') === normName)
    );
    if (completedDuplicate) {
      setActiveExamId(null);
      setActiveTab('siswa-nilai');
      return;
    }

    const isRegistered = database.users.some((u) => u.id === student.id);
    if (isRegistered) {
      setGuestStudent(null);
      saveSessionUserId(student.id);
    } else {
      setGuestStudent(student);
      saveSessionUserId(null);
    }
    setCurrentUserId(student.id);
    setActiveTab('siswa-ujian');

    const existing = database.submissions.find(
      (s) =>
        s.examId === exam.id &&
        (s.studentId === student.id ||
          s.studentNis.trim().toLowerCase() === normNumber)
    );
    if (existing && existing.status === 'selesai') {
      setActiveExamId(null);
      setActiveTab('siswa-nilai');
      return;
    }

    if (!existing) {
      const freshSub: ExamSubmission = {
        id: `sub-${Date.now()}`,
        examId: exam.id,
        studentId: student.id,
        studentName: student.name,
        studentNis: student.username,
        studentClass: student.kelas,
        answers: {},
        flaggedIds: [],
        essayScores: {},
        essayFeedback: {},
        autoScore: 0,
        essayScoreTotal: 0,
        finalScore: 0,
        status: 'sedang_mengerjakan',
        tabSwitches: 0,
        startedAt: new Date().toISOString(),
        remainingSeconds: exam.durationMinutes * 60,
      };
      commitDatabase(
        (prev) => ({
          ...prev,
          submissions: [...prev.submissions, freshSub],
        }),
        {
          actorName: student.name,
          actorRole: 'siswa',
          action: 'Masuk Kode Ujian',
          detail: `Memasuki ${exam.title} dengan kode ${exam.token} (${student.kelas} · No. ${student.username})`,
          examId: exam.id,
          examTitle: exam.title,
          studentNis: student.username,
          studentClass: student.kelas,
        }
      );
    } else {
      commitDatabase(
        (prev) => ({
          ...prev,
          submissions: prev.submissions.map((s) =>
            s.id === existing.id
              ? {
                  ...s,
                  studentId: student.id,
                  studentName: student.name,
                  studentNis: student.username,
                  studentClass: student.kelas,
                }
              : s
          ),
        }),
        {
          actorName: student.name,
          actorRole: 'siswa',
          action: 'Masuk Kode Ujian',
          detail: `Melanjutkan sesi ${exam.title} (${student.kelas} · No. ${student.username})`,
          examId: exam.id,
          examTitle: exam.title,
          studentNis: student.username,
          studentClass: student.kelas,
        }
      );
    }
    setActiveExamId(exam.id);
  };

  const handleLogout = () => {
    if (currentUser) {
      commitDatabase((prev) => prev, {
        actorName: currentUser.name,
        actorRole: currentUser.role,
        action: 'Logout',
        detail: 'Keluar dari sesi portal ujian',
      });
    }
    setCurrentUserId(null);
    setGuestStudent(null);
    setPendingStudentExam(null);
    setActiveExamId(null);
    saveSessionUserId(null);
  };

  const handleSelectTab = (tab: PortalTab) => {
    if (!currentUser) return;
    if (!canAccessTab(currentUser.role, tab)) return;
    setActiveTab(tab);
  };

  const handleChangePassword = (updatedUser: User, updatedUsers: User[]) => {
    commitDatabase(
      (prev) => ({
        ...prev,
        users: updatedUsers,
      }),
      {
        actorName: updatedUser.name,
        actorRole: updatedUser.role,
        action: 'Ganti Password',
        detail: `Pengguna ${updatedUser.username} memperbarui kata sandi`,
      }
    );
  };

  // Student Exam Flow
  const handleStartExam = (exam: Exam) => {
    if (!currentUser || currentUser.role !== 'siswa') return;

    const existing = database.submissions.find(
      (s) => s.examId === exam.id && s.studentId === currentUser.id
    );
    if (!existing) {
      const freshSub: ExamSubmission = {
        id: `sub-${Date.now()}`,
        examId: exam.id,
        studentId: currentUser.id,
        studentName: currentUser.name,
        studentNis: currentUser.username,
        studentClass: currentUser.kelas,
        answers: {},
        flaggedIds: [],
        essayScores: {},
        essayFeedback: {},
        autoScore: 0,
        essayScoreTotal: 0,
        finalScore: 0,
        status: 'sedang_mengerjakan',
        tabSwitches: 0,
        startedAt: new Date().toISOString(),
        remainingSeconds: exam.durationMinutes * 60,
      };
      commitDatabase(
        (prev) => ({
          ...prev,
          submissions: [...prev.submissions, freshSub],
        }),
        {
          actorName: currentUser.name,
          actorRole: 'siswa',
          action: 'Mulai Ujian',
          detail: `Memulai ${exam.title} (Kelas ${currentUser.kelas})`,
          examId: exam.id,
          examTitle: exam.title,
          studentNis: currentUser.username,
          studentClass: currentUser.kelas,
        }
      );
    }
    setActiveExamId(exam.id);
  };

  const handleSaveExamProgress = (updatedSub: ExamSubmission) => {
    commitDatabase((prev) => ({
      ...prev,
      submissions: prev.submissions.map((s) =>
        s.id === updatedSub.id && s.status !== 'selesai' ? updatedSub : s
      ),
    }));
  };

  const handleFinalSubmitExam = (finalizedSub: ExamSubmission) => {
    const existingSub = database.submissions.find((s) => s.id === finalizedSub.id);
    if (existingSub?.status === 'selesai') {
      setActiveExamId(null);
      setActiveTab('siswa-nilai');
      return;
    }

    const exam = database.exams.find((e) => e.id === finalizedSub.examId);
    if (!exam) return;
    const examQuestions = database.questions.filter((q) =>
      exam.questionIds.includes(q.id)
    );
    const calc = gradeSubmission(
      examQuestions,
      finalizedSub.answers,
      finalizedSub.essayScores
    );
    const completed: ExamSubmission = {
      ...finalizedSub,
      status: 'selesai',
      submittedAt: new Date().toISOString(),
      autoScore: calc.autoScore,
      essayScoreTotal: calc.essayScoreTotal,
      finalScore: calc.finalScore,
    };
    commitDatabase(
      (prev) => ({
        ...prev,
        submissions: prev.submissions.map((s) =>
          s.id === completed.id ? completed : s
        ),
      }),
      {
        actorName: completed.studentName,
        actorRole: 'siswa',
        action: completed.autoSubmittedReason ? 'Kumpul Ujian Otomatis' : 'Kumpul Ujian',
        detail: completed.autoSubmittedReason
          ? `${exam.title}: ${completed.autoSubmittedReason} (Nilai Sementara: ${calc.finalScore})`
          : `Mengumpulkan ${exam.title} (Nilai Sementara: ${calc.finalScore})`,
        examId: exam.id,
        examTitle: exam.title,
        studentNis: completed.studentNis,
        studentClass: completed.studentClass,
      }
    );
    setActiveExamId(null);
    setActiveTab('siswa-nilai');
  };

  // Teacher & Admin Mutations
  const handleAddQuestion = (q: Question) => {
    if (!currentUser) return;
    if (
      currentUser.role === 'guru' &&
      !isTeacherSubjectMatch(currentUser.mapel, q.subject)
    ) {
      return;
    }
    commitDatabase(
      (prev) => ({
        ...prev,
        questions: [q, ...prev.questions],
      }),
      {
        actorName: currentUser.name,
        actorRole: currentUser.role,
        action: 'Tambah Soal',
        detail: `Menambahkan soal ${q.subject} (${q.type.toUpperCase()})`,
      }
    );
  };

  const handleDeleteQuestion = (questionId: string) => {
    if (!currentUser) return;
    const targetQ = database.questions.find((q) => q.id === questionId);
    if (
      currentUser.role === 'guru' &&
      targetQ &&
      !isTeacherSubjectMatch(currentUser.mapel, targetQ.subject)
    ) {
      return;
    }
    commitDatabase(
      (prev) => ({
        ...prev,
        questions: prev.questions.filter((q) => q.id !== questionId),
        exams: prev.exams.map((ex) => ({
          ...ex,
          questionIds: ex.questionIds.filter((id) => id !== questionId),
        })),
      }),
      {
        actorName: currentUser.name,
        actorRole: currentUser.role,
        action: 'Hapus Soal',
        detail: `Menghapus butir soal ${questionId}`,
      }
    );
  };

  const handleSaveExam = (exam: Exam) => {
    if (!currentUser) return;
    if (
      currentUser.role === 'guru' &&
      !isTeacherSubjectMatch(currentUser.mapel, exam.subject)
    ) {
      return;
    }
    commitDatabase(
      (prev) => {
        const exists = prev.exams.some((e) => e.id === exam.id);
        return {
          ...prev,
          exams: exists
            ? prev.exams.map((e) => (e.id === exam.id ? exam : e))
            : [exam, ...prev.exams],
        };
      },
      {
        actorName: currentUser.name,
        actorRole: currentUser.role,
        action: 'Simpan Jadwal Ujian',
        detail: `${exam.title} (${exam.targetClass})`,
      }
    );
  };

  const handleDeleteExam = (examId: string) => {
    if (!currentUser) return;
    commitDatabase(
      (prev) => ({
        ...prev,
        exams: prev.exams.filter((e) => e.id !== examId),
      }),
      {
        actorName: currentUser.name,
        actorRole: currentUser.role,
        action: 'Hapus Jadwal',
        detail: `Menghapus jadwal ujian ${examId}`,
      }
    );
  };

  const handleUpdateSubmission = (sub: ExamSubmission) => {
    if (!currentUser) return;
    const targetExam = database.exams.find((e) => e.id === sub.examId);
    if (
      currentUser.role === 'guru' &&
      targetExam &&
      !isTeacherSubjectMatch(currentUser.mapel, targetExam.subject)
    ) {
      return;
    }
    commitDatabase(
      (prev) => ({
        ...prev,
        submissions: prev.submissions.map((s) => (s.id === sub.id ? sub : s)),
      }),
      {
        actorName: currentUser.name,
        actorRole: currentUser.role,
        action: 'Koreksi Nilai',
        detail: `Memperbarui nilai ${sub.studentName} menjadi ${sub.finalScore}`,
      }
    );
  };

  const handleAddUser = (newUser: User) => {
    if (!currentUser) return;
    commitDatabase(
      (prev) => ({
        ...prev,
        users: [newUser, ...prev.users],
      }),
      {
        actorName: currentUser.name,
        actorRole: currentUser.role,
        action: 'Tambah Pengguna',
        detail: `Menambahkan akun ${newUser.role}: ${newUser.name} (${newUser.username})`,
      }
    );
  };

  const handleBulkImportUsers = (toInsert: User[], toUpdate: User[]) => {
    if (!currentUser) return;
    if (toInsert.length === 0 && toUpdate.length === 0) return;
    const updateById = new Map(toUpdate.map((u) => [u.id, u]));
    commitDatabase(
      (prev) => ({
        ...prev,
        users: [
          ...toInsert,
          ...prev.users.map((u) => updateById.get(u.id) ?? u),
        ],
      }),
      {
        actorName: currentUser.name,
        actorRole: currentUser.role,
        action: 'Import Excel Pengguna',
        detail: `Mengimpor ${toInsert.length} akun baru dan memperbarui ${toUpdate.length} akun`,
      }
    );
  };

  const handleUpdateUser = (updated: User) => {
    if (!currentUser) return;
    commitDatabase(
      (prev) => ({
        ...prev,
        users: prev.users.map((u) => (u.id === updated.id ? updated : u)),
      }),
      {
        actorName: currentUser.name,
        actorRole: currentUser.role,
        action: 'Ubah Pengguna',
        detail: `Memperbarui akun ${updated.name} (${updated.active ? 'Aktif' : 'Nonaktif'})`,
      }
    );
  };

  const handleDeleteUser = (userId: string) => {
    if (!currentUser) return;
    const target = database.users.find((u) => u.id === userId);
    commitDatabase(
      (prev) => ({
        ...prev,
        users: prev.users.filter((u) => u.id !== userId),
      }),
      {
        actorName: currentUser.name,
        actorRole: currentUser.role,
        action: 'Hapus Pengguna',
        detail: `Menghapus akun ${target?.name ?? userId}`,
      }
    );
  };

  const handleUpdateSettings = (settings: SystemSettings) => {
    if (!currentUser) return;
    commitDatabase(
      (prev) => ({
        ...prev,
        settings,
      }),
      {
        actorName: currentUser.name,
        actorRole: currentUser.role,
        action: 'Ubah Konfigurasi',
        detail: `Memperbarui konfigurasi sistem ${settings.schoolName}`,
      }
    );
  };

  const handleResetSystem = async () => {
    const fresh = await resetDatabase(capabilities);
    setDatabase(fresh);
  };

  if (!ready) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-sm font-medium text-slate-600">
          Memuat Sistem Ujian SMP Kartini 1 Batam...
        </div>
      </div>
    );
  }

  if (!currentUser) {
    if (pendingStudentExam) {
      return (
        <StudentIdentityGate
          exam={pendingStudentExam}
          users={database.users}
          submissions={database.submissions}
          settings={database.settings}
          onBack={() => setPendingStudentExam(null)}
          onConfirm={(student) => {
            const targetExam = pendingStudentExam;
            setPendingStudentExam(null);
            handleStudentExamEnter(targetExam, student);
          }}
        />
      );
    }

    return (
      <>
        <LoginView
          users={database.users}
          exams={database.exams}
          settings={database.settings}
          onLoginSuccess={handleLoginSuccess}
          onStudentCodeVerified={(exam) => setPendingStudentExam(exam)}
          onOpenChangePassword={() => setShowChangePasswordModal(true)}
        />
        {showChangePasswordModal && (
          <ChangePasswordModal
            users={database.users}
            onPasswordChanged={handleChangePassword}
            onClose={() => setShowChangePasswordModal(false)}
          />
        )}
      </>
    );
  }

  // Active CBT Runner for Siswa
  if (currentUser.role === 'siswa' && activeExamId) {
    const activeExam = database.exams.find((e) => e.id === activeExamId);
    const activeSubmission = database.submissions.find(
      (s) =>
        s.examId === activeExamId &&
        s.studentId === currentUser.id &&
        s.status === 'sedang_mengerjakan'
    );
    if (activeExam && activeSubmission) {
      const examQuestions = database.questions.filter((q) =>
        activeExam.questionIds.includes(q.id)
      );
      return (
        <ExamRunner
          exam={activeExam}
          questions={examQuestions}
          submission={activeSubmission}
          maxTabSwitchWarnings={database.settings.maxTabSwitchWarnings}
          onSaveProgress={handleSaveExamProgress}
          onFinalSubmit={handleFinalSubmitExam}
          onExitWithoutSubmit={() => setActiveExamId(null)}
          onLogExamEvent={(action, detail) => {
            commitDatabase((prev) => prev, {
              actorName: activeSubmission.studentName,
              actorRole: 'siswa',
              action,
              detail,
              examId: activeExam.id,
              examTitle: activeExam.title,
              studentNis: activeSubmission.studentNis,
              studentClass: activeSubmission.studentClass,
            });
          }}
        />
      );
    }
  }

  const effectiveTab = canAccessTab(currentUser.role, activeTab)
    ? activeTab
    : getDefaultTabForRole(currentUser.role);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <TopBar
        schoolName={database.settings.schoolName}
        logoUrl={database.settings.logoUrl}
        user={currentUser}
        activeTab={effectiveTab}
        onSelectTab={handleSelectTab}
        onOpenChangePassword={() => setShowChangePasswordModal(true)}
        onLogout={handleLogout}
      />

      <main className="flex-1">
        {currentUser.role === 'siswa' && (
          <StudentPortal
            user={currentUser}
            activeTab={effectiveTab}
            exams={database.exams}
            questions={database.questions}
            submissions={database.submissions}
            settings={database.settings}
            onStartExam={handleStartExam}
          />
        )}

        {currentUser.role === 'guru' && (
          <TeacherPortal
            user={currentUser}
            activeTab={effectiveTab}
            users={database.users}
            questions={database.questions}
            exams={database.exams}
            submissions={database.submissions}
            activityLogs={database.activityLogs ?? []}
            capabilities={capabilities}
            onAddQuestion={handleAddQuestion}
            onDeleteQuestion={handleDeleteQuestion}
            onSaveExam={handleSaveExam}
            onUpdateSubmission={handleUpdateSubmission}
          />
        )}

        {currentUser.role === 'admin' && (
          <AdminPortal
            user={currentUser}
            activeTab={effectiveTab}
            database={database}
            capabilities={capabilities}
            onSelectTab={handleSelectTab}
            onAddUser={handleAddUser}
            onBulkImportUsers={handleBulkImportUsers}
            onUpdateUser={handleUpdateUser}
            onDeleteUser={handleDeleteUser}
            onSaveExam={handleSaveExam}
            onDeleteExam={handleDeleteExam}
            onUpdateSettings={handleUpdateSettings}
            onResetSystem={handleResetSystem}
          />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 px-4 sm:px-6 mt-auto print:hidden">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            © 2026 {database.settings.schoolName} · Tahun Ajaran{' '}
            {database.settings.academicYear} ({database.settings.semester})
          </span>
          <span>
            Mode Data:{' '}
            {capabilities.mode === 'server'
              ? 'Server Node.js + JSON'
              : 'Mode Statis Browser (Kompatibel GitHub Pages)'}
          </span>
        </div>
      </footer>

      {showChangePasswordModal && (
        <ChangePasswordModal
          users={database.users}
          lockedUsername={
            !currentUser.id.startsWith('usr-peserta-')
              ? currentUser.username
              : undefined
          }
          onPasswordChanged={handleChangePassword}
          onClose={() => setShowChangePasswordModal(false)}
        />
      )}
    </div>
  );
}
