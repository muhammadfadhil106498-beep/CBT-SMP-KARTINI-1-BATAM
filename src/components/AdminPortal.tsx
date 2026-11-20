import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  CreditCard,
  Download,
  FileSpreadsheet,
  Image as ImageIcon,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Search,
  Trash2,
  Upload,
  UserPlus,
} from 'lucide-react';
import type {
  ActivityLog,
  AppDatabase,
  Exam,
  ExamStatus,
  SystemSettings,
  User,
  UserRole,
} from '../types/exam';
import { detectScheduleConflicts, PortalTab } from '../utils/examEngine';
import {
  downloadUserImportTemplate,
  parseImportedUserRows,
  readSpreadsheetRows,
  UserImportResult,
} from '../utils/userImport';
import { readAndResizeImageAsDataUrl } from '../utils/imageUpload';
import type { BackendCapabilities } from '../services/storage';
import { ExamCardPrinter } from './ExamCardPrinter';
import { GradeAndLogReportPanel } from './GradeAndLogReportPanel';

const DEFAULT_LOGO_PATH = './src/assets/images/kartini_crest_1795078071603.jpg';
const DEFAULT_HERO_PATH = './src/assets/images/smp_kartini_campus_v2_1795078091161.jpg';

interface AdminPortalProps {
  user: User;
  activeTab: PortalTab;
  database: AppDatabase;
  capabilities: BackendCapabilities;
  onSelectTab?: (tab: PortalTab) => void;
  onAddUser: (newUser: User) => void;
  onBulkImportUsers: (toInsert: User[], toUpdate: User[]) => void;
  onUpdateUser: (updated: User) => void;
  onDeleteUser: (userId: string) => void;
  onSaveExam: (exam: Exam) => void;
  onDeleteExam: (examId: string) => void;
  onUpdateSettings: (settings: SystemSettings) => void;
  onResetSystem: () => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({
  user,
  activeTab,
  database,
  capabilities,
  onSelectTab,
  onAddUser,
  onBulkImportUsers,
  onUpdateUser,
  onDeleteUser,
  onSaveExam,
  onDeleteExam,
  onUpdateSettings,
  onResetSystem,
}) => {
  const { users, exams, submissions, questions, settings } = database;
  const activityLogs: ActivityLog[] = database.activityLogs ?? [];

  // User Management State
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'semua' | UserRole>('semua');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFileName, setImportFileName] = useState<string>('');
  const [importRawRows, setImportRawRows] = useState<Record<string, unknown>[]>([]);
  const [importUpdateExisting, setImportUpdateExisting] = useState(false);
  const [importFileError, setImportFileError] = useState<string | null>(null);
  const [importBannerMsg, setImportBannerMsg] = useState<string | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formUsername, setFormUsername] = useState('');
  const [formName, setFormName] = useState('');
  const [formPassword, setFormPassword] = useState('123');
  const [formRole, setFormRole] = useState<UserRole>('siswa');
  const [formKelas, setFormKelas] = useState('9A');
  const [formMapel, setFormMapel] = useState('');
  const [userFormError, setUserFormError] = useState<string | null>(null);

  // Schedule Modal State
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [exTitle, setExTitle] = useState('');
  const [exSubject, setExSubject] = useState('Matematika');
  const [exTargetClass, setExTargetClass] = useState('Semua Kelas 9');
  const [exRoom, setExRoom] = useState('Lab Komputer 1');
  const [exTeacherId, setExTeacherId] = useState(
    users.find((u) => u.role === 'guru')?.id ?? ''
  );
  const [exStartTime, setExStartTime] = useState('2026-11-20T08:00');
  const [exEndTime, setExEndTime] = useState('2026-11-20T09:30');
  const [exDuration, setExDuration] = useState(60);
  const [exToken, setExToken] = useState('KRT26A');
  const [exStatus, setExStatus] = useState<ExamStatus>('terjadwal');
  const [exRequireToken, setExRequireToken] = useState(true);

  // Report filter state
  const [reportExamId, setReportExamId] = useState<string>('semua');

  // System Settings Draft
  const [draftSettings, setDraftSettings] = useState<SystemSettings>(settings);
  const [settingsSavedMsg, setSettingsSavedMsg] = useState<string | null>(null);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    setDraftSettings(settings);
  }, [settings]);

  const handleBrandImageUpload = async (
    field: 'logoUrl' | 'heroImageUrl',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploadError(null);
    try {
      const processed = await readAndResizeImageAsDataUrl(
        file,
        field === 'logoUrl'
          ? { maxWidth: 256, maxHeight: 256, quality: 0.9 }
          : { maxWidth: 1280, maxHeight: 720, quality: 0.84 }
      );
      setDraftSettings((prev) => ({ ...prev, [field]: processed.dataUrl }));
    } catch (err) {
      setImageUploadError(
        err instanceof Error ? err.message : 'Gagal memproses gambar.'
      );
    }
  };

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return users.filter((u) => {
      const matchRole = roleFilter === 'semua' ? true : u.role === roleFilter;
      const matchQuery =
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.kelas.toLowerCase().includes(q);
      return matchRole && matchQuery;
    });
  }, [users, userSearch, roleFilter]);

  const importPreview: UserImportResult | null = useMemo(() => {
    if (importRawRows.length === 0) return null;
    return parseImportedUserRows(importRawRows, users, {
      updateExisting: importUpdateExisting,
    });
  }, [importRawRows, users, importUpdateExisting]);

  const handleOpenImportModal = () => {
    setImportFileName('');
    setImportRawRows([]);
    setImportFileError(null);
    setImportUpdateExisting(false);
    setShowImportModal(true);
  };

  const handleImportFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileError(null);
    setImportFileName(file.name);
    try {
      const rows = await readSpreadsheetRows(file);
      if (rows.length === 0) {
        setImportRawRows([]);
        setImportFileError(
          'File Excel kosong atau tidak memiliki baris data di bawah header.'
        );
        return;
      }
      setImportRawRows(rows);
    } catch (err) {
      setImportRawRows([]);
      setImportFileError(
        err instanceof Error
          ? err.message
          : 'Gagal membaca file Excel. Pastikan format .xlsx, .xls, atau .csv valid.'
      );
    }
  };

  const handleConfirmBulkImport = () => {
    if (!importPreview) return;
    const { toInsert, toUpdate } = importPreview;
    if (toInsert.length === 0 && toUpdate.length === 0) return;
    onBulkImportUsers(toInsert, toUpdate);
    setShowImportModal(false);
    setImportBannerMsg(
      `Berhasil mengimpor ${toInsert.length} akun baru dan memperbarui ${toUpdate.length} akun.`
    );
    setTimeout(() => setImportBannerMsg(null), 5000);
  };

  const conflicts = useMemo(() => detectScheduleConflicts(exams), [exams]);
  const teachers = useMemo(() => users.filter((u) => u.role === 'guru'), [users]);

  const systemMetrics = useMemo(() => {
    const siswaCount = users.filter((u) => u.role === 'siswa' && u.active).length;
    const guruCount = users.filter((u) => u.role === 'guru' && u.active).length;
    const activeExams = exams.filter((e) => e.status === 'berlangsung').length;
    const ongoingSessions = submissions.filter(
      (s) => s.status === 'sedang_mengerjakan'
    ).length;
    const finishedSubs = submissions.filter((s) => s.status === 'selesai');
    const overallAvg =
      finishedSubs.length > 0
        ? Math.round(
            (finishedSubs.reduce((acc, s) => acc + s.finalScore, 0) /
              finishedSubs.length) *
              10
          ) / 10
        : 0;
    return {
      siswaCount,
      guruCount,
      activeExams,
      ongoingSessions,
      completedSubmissions: finishedSubs.length,
      overallAvg,
    };
  }, [users, exams, submissions]);

  const openAddUserModal = () => {
    setEditingUser(null);
    setFormUsername('');
    setFormName('');
    setFormPassword('123');
    setFormRole('siswa');
    setFormKelas('9A');
    setFormMapel('');
    setUserFormError(null);
    setShowUserModal(true);
  };

  const openEditUserModal = (target: User) => {
    setEditingUser(target);
    setFormUsername(target.username);
    setFormName(target.name);
    setFormPassword(target.password);
    setFormRole(target.role);
    setFormKelas(target.kelas);
    setFormMapel(target.mapel ?? '');
    setUserFormError(null);
    setShowUserModal(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUsername.trim() || !formName.trim() || !formPassword.trim()) {
      setUserFormError('NIS/NIP, nama lengkap, dan kata sandi wajib diisi.');
      return;
    }

    const duplicate = users.find(
      (u) =>
        u.username.toLowerCase() === formUsername.trim().toLowerCase() &&
        u.id !== editingUser?.id
    );
    if (duplicate) {
      setUserFormError('Username (NIS/NIP) sudah digunakan oleh akun lain.');
      return;
    }

    if (editingUser) {
      onUpdateUser({
        ...editingUser,
        username: formUsername.trim(),
        name: formName.trim(),
        password: formPassword.trim(),
        role: formRole,
        kelas: formRole === 'siswa' ? formKelas.trim() || '7A' : '-',
        mapel: formRole === 'guru' ? formMapel.trim() || 'Umum' : undefined,
      });
    } else {
      onAddUser({
        id: `usr-${Date.now()}`,
        username: formUsername.trim(),
        password: formPassword.trim(),
        name: formName.trim(),
        role: formRole,
        kelas: formRole === 'siswa' ? formKelas.trim() || '7A' : '-',
        mapel: formRole === 'guru' ? formMapel.trim() || 'Umum' : undefined,
        active: true,
        createdAt: new Date().toISOString(),
      });
    }
    setShowUserModal(false);
  };

  const openAddSchedule = () => {
    setEditingExam(null);
    setExTitle('');
    setExSubject('Matematika');
    setExTargetClass('Semua Kelas 9');
    setExRoom('Lab Komputer 1');
    setExTeacherId(teachers[0]?.id ?? '');
    setExStartTime('2026-11-21T08:00');
    setExEndTime('2026-11-21T09:30');
    setExDuration(60);
    setExToken('KRT26A');
    setExStatus('terjadwal');
    setExRequireToken(true);
    setShowScheduleModal(true);
  };

  const openEditSchedule = (exam: Exam) => {
    setEditingExam(exam);
    setExTitle(exam.title);
    setExSubject(exam.subject);
    setExTargetClass(exam.targetClass);
    setExRoom(exam.room);
    setExTeacherId(exam.teacherId);
    setExStartTime(exam.startTime);
    setExEndTime(exam.endTime);
    setExDuration(exam.durationMinutes);
    setExToken(exam.token);
    setExStatus(exam.status);
    setExRequireToken(exam.requireToken);
    setShowScheduleModal(true);
  };

  const handleSaveSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!exTitle.trim()) return;
    const teacher = teachers.find((t) => t.id === exTeacherId);
    const defaultQuestions =
      editingExam?.questionIds ??
      questions
        .filter((q) => q.subject.toLowerCase() === exSubject.toLowerCase())
        .slice(0, 3)
        .map((q) => q.id);

    const payload: Exam = {
      id: editingExam?.id ?? `ex-${Date.now()}`,
      title: exTitle.trim(),
      subject: exSubject,
      targetClass: exTargetClass,
      gradeLevel: exTargetClass.includes('7')
        ? '7'
        : exTargetClass.includes('8')
        ? '8'
        : '9',
      teacherId: teacher?.id ?? user.id,
      teacherName: teacher?.name ?? user.name,
      durationMinutes: Math.max(5, Number(exDuration) || 45),
      startTime: exStartTime,
      endTime: exEndTime,
      token: exToken.trim().toUpperCase() || 'KRT001',
      requireToken: exRequireToken,
      shuffleQuestions: editingExam?.shuffleQuestions ?? settings.defaultShuffle,
      showResultToStudent:
        editingExam?.showResultToStudent ?? settings.allowStudentScorePreview,
      status: exStatus,
      questionIds:
        defaultQuestions.length > 0
          ? defaultQuestions
          : questions.slice(0, 2).map((q) => q.id),
      room: exRoom.trim() || 'Lab Komputer 1',
    };
    onSaveExam(payload);
    setShowScheduleModal(false);
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings(draftSettings);
    setSettingsSavedMsg('Pengaturan sistem berhasil diperbarui.');
    setTimeout(() => setSettingsSavedMsg(null), 3500);
  };

  const handleExportJsonBackup = () => {
    const blob = new Blob([JSON.stringify(database, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-cbt-smp-kartini-1-batam.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // TAB: Cetak Kartu Peserta Ujian (Ukuran Kartu Debit / ID Card CR80)
  if (activeTab === 'admin-kartu') {
    return <ExamCardPrinter users={users} exams={exams} settings={settings} />;
  }

  // TAB: Laporan Log Pengerjaan Siswa & Hasil Nilai Per Kelas
  if (activeTab === 'admin-laporan') {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <GradeAndLogReportPanel
          title="Laporan Nilai Per Kelas & Log Pengerjaan Siswa"
          subtitle="Pantau tabel hasil nilai seluruh peserta per kelas, unduh laporan Excel (.xlsx), serta audit log pengerjaan dan pelanggaran ujian."
          exams={exams}
          questions={questions}
          submissions={submissions}
          activityLogs={activityLogs}
          selectedExamId={reportExamId}
          onChangeExamId={setReportExamId}
        />
      </div>
    );
  }

  // TAB 2: Manajemen Jadwal Ujian Global
  if (activeTab === 'admin-jadwal') {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900">
              Manajemen Jadwal Ujian Global
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Atur jadwal pelaksanaan, ruang ujian, token akses, dan deteksi bentrok jadwal lintas kelas.
            </p>
          </div>
          <button
            type="button"
            onClick={openAddSchedule}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
          >
            <CalendarClock className="w-4 h-4" />
            <span>Tambah Jadwal Ujian</span>
          </button>
        </div>

        {conflicts.length > 0 && (
          <div
            role="alert"
            className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-1.5"
          >
            <div className="flex items-center gap-2 text-sm font-bold text-amber-900">
              <AlertTriangle className="w-4 h-4" />
              <span>Terdeteksi {conflicts.length} Potensi Bentrok Jadwal</span>
            </div>
            {conflicts.map((c, idx) => (
              <p key={idx} className="text-xs text-amber-900 pl-6">
                {c.reason}
              </p>
            ))}
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3.5 px-5">Ujian & Mata Pelajaran</th>
                  <th className="py-3.5 px-4">Target Kelas</th>
                  <th className="py-3.5 px-4">Ruang</th>
                  <th className="py-3.5 px-4">Waktu</th>
                  <th className="py-3.5 px-4">Token</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-5 text-right">Kelola</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {exams.map((ex) => (
                  <tr key={ex.id} className="hover:bg-slate-50">
                    <td className="py-3.5 px-5">
                      <p className="font-semibold text-slate-900">{ex.title}</p>
                      <p className="text-xs text-slate-500">
                        {ex.subject} · {ex.teacherName} ·{' '}
                        <span className="font-mono tabular-nums">
                          {ex.durationMinutes} mnt
                        </span>
                      </p>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">{ex.targetClass}</td>
                    <td className="py-3.5 px-4 text-slate-700">{ex.room}</td>
                    <td className="py-3.5 px-4 font-mono text-xs tabular-nums text-slate-600">
                      <div>{ex.startTime.replace('T', ' ')}</div>
                      <div>s.d. {ex.endTime.replace('T', ' ')}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs font-semibold text-slate-900">
                      {ex.token}{' '}
                      <span className="font-sans font-normal text-slate-500">
                        ({ex.requireToken ? 'Wajib' : 'Bebas'})
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs font-semibold">
                      {ex.status === 'berlangsung' && (
                        <span className="text-emerald-700">Berlangsung</span>
                      )}
                      {ex.status === 'terjadwal' && (
                        <span className="text-amber-700">Terjadwal</span>
                      )}
                      {ex.status === 'selesai' && (
                        <span className="text-slate-500">Selesai</span>
                      )}
                      {ex.status === 'draft' && (
                        <span className="text-slate-400">Draf</span>
                      )}
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          aria-label={`Edit jadwal ${ex.title}`}
                          onClick={() => openEditSchedule(ex)}
                          className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Hapus jadwal ${ex.title}`}
                          onClick={() => onDeleteExam(ex.id)}
                          className="p-2 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Schedule Modal */}
        {showScheduleModal && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-modal-title"
            className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4"
          >
            <form
              onSubmit={handleSaveSchedule}
              className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <h2
                id="schedule-modal-title"
                className="font-display text-lg font-bold text-slate-900"
              >
                {editingExam ? 'Ubah Jadwal Ujian' : 'Tambah Jadwal Ujian Baru'}
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label
                    htmlFor="sched-title"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Nama Ujian
                  </label>
                  <input
                    id="sched-title"
                    required
                    type="text"
                    value={exTitle}
                    onChange={(e) => setExTitle(e.target.value)}
                    placeholder="Contoh: PAS Bahasa Inggris Kelas 9"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label
                    htmlFor="sched-subject"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Mata Pelajaran
                  </label>
                  <input
                    id="sched-subject"
                    type="text"
                    value={exSubject}
                    onChange={(e) => setExSubject(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label
                    htmlFor="sched-class"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Target Kelas
                  </label>
                  <input
                    id="sched-class"
                    type="text"
                    value={exTargetClass}
                    onChange={(e) => setExTargetClass(e.target.value)}
                    placeholder="Contoh: Semua Kelas 9 atau 9A"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label
                    htmlFor="sched-room"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Ruang Ujian
                  </label>
                  <input
                    id="sched-room"
                    type="text"
                    value={exRoom}
                    onChange={(e) => setExRoom(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label
                    htmlFor="sched-teacher"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Guru Pengampu
                  </label>
                  <select
                    id="sched-teacher"
                    value={exTeacherId}
                    onChange={(e) => setExTeacherId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="sched-start"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Waktu Mulai
                  </label>
                  <input
                    id="sched-start"
                    type="datetime-local"
                    value={exStartTime}
                    onChange={(e) => setExStartTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label
                    htmlFor="sched-end"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Waktu Selesai
                  </label>
                  <input
                    id="sched-end"
                    type="datetime-local"
                    value={exEndTime}
                    onChange={(e) => setExEndTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label
                    htmlFor="sched-dur"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Durasi (menit)
                  </label>
                  <input
                    id="sched-dur"
                    type="number"
                    min={5}
                    value={exDuration}
                    onChange={(e) => setExDuration(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label
                    htmlFor="sched-token"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Token
                  </label>
                  <input
                    id="sched-token"
                    type="text"
                    value={exToken}
                    onChange={(e) => setExToken(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 text-sm font-mono uppercase border border-slate-300 rounded-lg"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label
                    htmlFor="sched-status"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Status Pelaksanaan
                  </label>
                  <select
                    id="sched-status"
                    value={exStatus}
                    onChange={(e) => setExStatus(e.target.value as ExamStatus)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="terjadwal">Terjadwal</option>
                    <option value="berlangsung">Berlangsung (Aktif)</option>
                    <option value="selesai">Selesai</option>
                    <option value="draft">Draf</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exRequireToken}
                  onChange={(e) => setExRequireToken(e.target.checked)}
                  className="accent-teal-700"
                />
                <span>Wajibkan verifikasi token ujian</span>
              </label>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
                >
                  Simpan Jadwal
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  // TAB 3: Konfigurasi Sistem, Performa & Log Aktivitas
  if (activeTab === 'admin-sistem') {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900">
              Konfigurasi & Performa Sistem
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Kelola profil sekolah, kebijakan keamanan ujian, cadangan data, dan pantau aktivitas sistem.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleExportJsonBackup}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Ekspor JSON</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (!confirmReset) {
                  setConfirmReset(true);
                  return;
                }
                onResetSystem();
                setConfirmReset(false);
              }}
              onBlur={() => setConfirmReset(false)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border cursor-pointer ${
                confirmReset
                  ? 'text-white bg-red-700 border-red-700 hover:bg-red-800'
                  : 'text-red-700 bg-red-50 border-red-200 hover:bg-red-100'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{confirmReset ? 'Klik Lagi untuk Reset' : 'Reset Data Demo'}</span>
            </button>
          </div>
        </div>

        {/* Real System Performance KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs text-slate-500">Pengguna Aktif</p>
            <p className="font-mono text-2xl font-bold text-slate-900 tabular-nums mt-1">
              {systemMetrics.siswaCount + systemMetrics.guruCount}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {systemMetrics.siswaCount} Siswa · {systemMetrics.guruCount} Guru
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs text-slate-500">Ujian & Sesi Aktif</p>
            <p className="font-mono text-2xl font-bold text-teal-700 tabular-nums mt-1">
              {systemMetrics.activeExams} / {systemMetrics.ongoingSessions}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Ujian aktif / peserta berjalan
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs text-slate-500">Rata-rata Nilai Sekolah</p>
            <p className="font-mono text-2xl font-bold text-slate-900 tabular-nums mt-1">
              {systemMetrics.overallAvg}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Dari {systemMetrics.completedSubmissions} pengumpulan selesai
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs text-slate-500">Mode Penyimpanan</p>
            <p className="font-display text-lg font-bold text-slate-900 mt-1">
              {capabilities.mode === 'server'
                ? 'Server Node + JSON'
                : 'Browser Statis (GitHub)'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {capabilities.aiAvailable
                ? 'Gemini 4 Carbon Aktif'
                : 'Siap Uji Mandiri'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Configuration Form */}
          <form
            onSubmit={handleSaveSettings}
            className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5"
          >
            <h2 className="font-display text-lg font-bold text-slate-900">
              Pengaturan Sekolah & Kebijakan CBT
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="set-school"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Nama Sekolah
                </label>
                <input
                  id="set-school"
                  type="text"
                  value={draftSettings.schoolName}
                  onChange={(e) =>
                    setDraftSettings({ ...draftSettings, schoolName: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label
                  htmlFor="set-npsn"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  NPSN
                </label>
                <input
                  id="set-npsn"
                  type="text"
                  value={draftSettings.npsn}
                  onChange={(e) =>
                    setDraftSettings({ ...draftSettings, npsn: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label
                  htmlFor="set-year"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Tahun Ajaran
                </label>
                <input
                  id="set-year"
                  type="text"
                  value={draftSettings.academicYear}
                  onChange={(e) =>
                    setDraftSettings({
                      ...draftSettings,
                      academicYear: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label
                  htmlFor="set-sem"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Semester
                </label>
                <select
                  id="set-sem"
                  value={draftSettings.semester}
                  onChange={(e) =>
                    setDraftSettings({
                      ...draftSettings,
                      semester: e.target.value as 'Ganjil' | 'Genap',
                    })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="Ganjil">Ganjil</option>
                  <option value="Genap">Genap</option>
                </select>
              </div>
              <div className="sm:col-span-2 pt-3 border-t border-slate-200 space-y-4">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-teal-700" />
                  <h3 className="font-display text-sm font-bold text-slate-900">
                    Tampilan Halaman Index (Logo, Gambar Utama & Pengumuman)
                  </h3>
                </div>

                {/* Logo Sekolah */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-800">
                      Logo Sekolah (Index & Header)
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setDraftSettings({
                          ...draftSettings,
                          logoUrl: DEFAULT_LOGO_PATH,
                        })
                      }
                      className="text-xs font-medium text-teal-700 hover:text-teal-800 cursor-pointer"
                    >
                      Reset Logo Bawaan
                    </button>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="w-16 h-16 rounded-lg border border-slate-200 bg-white overflow-hidden shrink-0 flex items-center justify-center">
                      <img
                        src={draftSettings.logoUrl || DEFAULT_LOGO_PATH}
                        alt="Pratinjau logo sekolah"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 w-full space-y-2">
                      <div>
                        <label
                          htmlFor="set-logo-file"
                          className="block text-[11px] font-medium text-slate-600 mb-1"
                        >
                          Unggah File Logo (PNG, JPG, WebP, SVG)
                        </label>
                        <input
                          id="set-logo-file"
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleBrandImageUpload('logoUrl', e)}
                          className="block w-full text-xs text-slate-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-slate-300 file:text-xs file:font-semibold file:bg-white file:text-slate-800 hover:file:bg-slate-100 cursor-pointer"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="set-logo-url"
                          className="block text-[11px] font-medium text-slate-600 mb-1"
                        >
                          Atau Masukkan URL / Path Logo
                        </label>
                        <input
                          id="set-logo-url"
                          type="text"
                          value={draftSettings.logoUrl ?? ''}
                          onChange={(e) =>
                            setDraftSettings({
                              ...draftSettings,
                              logoUrl: e.target.value,
                            })
                          }
                          placeholder={DEFAULT_LOGO_PATH}
                          className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Gambar Utama / Banner Index */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-800">
                      Gambar Utama Halaman Index (Banner)
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setDraftSettings({
                          ...draftSettings,
                          heroImageUrl: DEFAULT_HERO_PATH,
                        })
                      }
                      className="text-xs font-medium text-teal-700 hover:text-teal-800 cursor-pointer"
                    >
                      Reset Gambar Bawaan
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div className="h-28 w-full rounded-lg border border-slate-200 bg-slate-900 overflow-hidden">
                      <img
                        src={draftSettings.heroImageUrl || DEFAULT_HERO_PATH}
                        alt="Pratinjau gambar halaman index"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="set-hero-file"
                          className="block text-[11px] font-medium text-slate-600 mb-1"
                        >
                          Unggah File Gambar Banner
                        </label>
                        <input
                          id="set-hero-file"
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleBrandImageUpload('heroImageUrl', e)}
                          className="block w-full text-xs text-slate-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-slate-300 file:text-xs file:font-semibold file:bg-white file:text-slate-800 hover:file:bg-slate-100 cursor-pointer"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="set-hero-url"
                          className="block text-[11px] font-medium text-slate-600 mb-1"
                        >
                          Atau URL / Path Gambar Banner
                        </label>
                        <input
                          id="set-hero-url"
                          type="text"
                          value={draftSettings.heroImageUrl ?? ''}
                          onChange={(e) =>
                            setDraftSettings({
                              ...draftSettings,
                              heroImageUrl: e.target.value,
                            })
                          }
                          placeholder={DEFAULT_HERO_PATH}
                          className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {imageUploadError && (
                  <p role="alert" className="text-xs font-medium text-red-700">
                    {imageUploadError}
                  </p>
                )}

                <div>
                  <label
                    htmlFor="set-announcement-title"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Judul Pengumuman Halaman Index
                  </label>
                  <input
                    id="set-announcement-title"
                    type="text"
                    value={draftSettings.announcementTitle ?? 'Pengumuman Akademik'}
                    onChange={(e) =>
                      setDraftSettings({
                        ...draftSettings,
                        announcementTitle: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label
                    htmlFor="set-announcement"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Isi Pengumuman Halaman Index
                  </label>
                  <textarea
                    id="set-announcement"
                    rows={3}
                    value={draftSettings.announcement}
                    onChange={(e) =>
                      setDraftSettings({
                        ...draftSettings,
                        announcement: e.target.value,
                      })
                    }
                    className="w-full p-3 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 space-y-2.5 text-sm text-slate-700">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draftSettings.defaultRequireToken}
                  onChange={(e) =>
                    setDraftSettings({
                      ...draftSettings,
                      defaultRequireToken: e.target.checked,
                    })
                  }
                  className="accent-teal-700"
                />
                <span>Wajibkan token ujian secara global untuk semua ujian</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draftSettings.allowStudentScorePreview}
                  onChange={(e) =>
                    setDraftSettings({
                      ...draftSettings,
                      allowStudentScorePreview: e.target.checked,
                    })
                  }
                  className="accent-teal-700"
                />
                <span>Izinkan siswa langsung melihat nilai PG setelah mengumpulkan</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draftSettings.maintenanceMode}
                  onChange={(e) =>
                    setDraftSettings({
                      ...draftSettings,
                      maintenanceMode: e.target.checked,
                    })
                  }
                  className="accent-teal-700"
                />
                <span>Aktifkan tanda pemeliharaan di halaman masuk</span>
              </label>
            </div>

            {settingsSavedMsg && (
              <p className="text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                {settingsSavedMsg}
              </p>
            )}

            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Simpan Konfigurasi Sistem</span>
            </button>
          </form>

          {/* Activity Log Feed */}
          <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2">
              <Activity className="w-4 h-4 text-teal-700" />
              <h2 className="font-display text-base font-bold text-slate-900">
                Log Aktivitas Sistem ({activityLogs.length})
              </h2>
            </div>

            <div className="divide-y divide-slate-200 max-h-[520px] overflow-y-auto">
              {activityLogs.length === 0 ? (
                <p className="p-6 text-sm text-slate-500 text-center">
                  Belum ada aktivitas tercatat.
                </p>
              ) : (
                activityLogs.slice(0, 20).map((log) => (
                  <div key={log.id} className="p-4 space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                      <span className="font-semibold text-slate-800">
                        {log.action} · {log.actorName}
                      </span>
                      <span className="font-mono tabular-nums">
                        {log.timestamp.slice(0, 16).replace('T', ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">{log.detail}</p>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    );
  }

  // TAB 1 (Default): Data Pengguna (Siswa, Guru, Admin)
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-teal-700 mb-1">
            Konsol Administrator · {user.name}
          </p>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Manajemen Data Pengguna
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Tambah, ubah, aktifkan/nonaktifkan, atau hapus akun Siswa, Guru, dan Admin.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {onSelectTab && (
            <button
              type="button"
              onClick={() => onSelectTab('admin-kartu')}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-sm font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
            >
              <CreditCard className="w-4 h-4 text-teal-700" />
              <span>Print Kartu Ujian</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleOpenImportModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-sm font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Upload className="w-4 h-4 text-teal-700" />
            <span>Import Excel</span>
          </button>
          <button
            type="button"
            onClick={openAddUserModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Tambah Pengguna</span>
          </button>
        </div>
      </div>

      {importBannerMsg && (
        <div
          role="status"
          className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-900"
        >
          {importBannerMsg}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Cari nama, NIS/NIP, atau kelas..."
              aria-label="Cari pengguna"
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(
              [
                { id: 'semua', label: 'Semua' },
                { id: 'siswa', label: 'Siswa' },
                { id: 'guru', label: 'Guru' },
                { id: 'admin', label: 'Admin' },
              ] as const
            ).map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRoleFilter(r.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 cursor-pointer ${
                  roleFilter === r.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3.5 px-5">NIS / NIP / ID</th>
                <th className="py-3.5 px-4">Nama Lengkap</th>
                <th className="py-3.5 px-4">Peran</th>
                <th className="py-3.5 px-4">Kelas / Mapel</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-5 text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="py-3.5 px-5 font-mono tabular-nums text-slate-700">
                    {u.username}
                  </td>
                  <td className="py-3.5 px-4 font-medium text-slate-900">
                    {u.name}
                  </td>
                  <td className="py-3.5 px-4 capitalize text-slate-700">
                    {u.role}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600">
                    {u.role === 'siswa' ? `Kelas ${u.kelas}` : u.mapel || '-'}
                  </td>
                  <td className="py-3.5 px-4 text-xs font-semibold">
                    <button
                      type="button"
                      disabled={u.id === user.id}
                      onClick={() => onUpdateUser({ ...u, active: !u.active })}
                      className={`cursor-pointer disabled:cursor-not-allowed ${
                        u.active ? 'text-emerald-700' : 'text-red-700'
                      }`}
                    >
                      {u.active ? 'Aktif' : 'Nonaktif'}
                    </button>
                  </td>
                  <td className="py-3.5 px-5 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        aria-label={`Edit pengguna ${u.name}`}
                        onClick={() => openEditUserModal(u)}
                        className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={u.id === user.id}
                        aria-label={`Hapus pengguna ${u.name}`}
                        onClick={() => onDeleteUser(u.id)}
                        className="p-2 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit User Modal */}
      {showUserModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="user-modal-title"
          className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleSaveUser}
            className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4"
          >
            <h2
              id="user-modal-title"
              className="font-display text-lg font-bold text-slate-900"
            >
              {editingUser ? 'Ubah Data Pengguna' : 'Tambah Akun Pengguna Baru'}
            </h2>

            <div className="space-y-3">
              <div>
                <label
                  htmlFor="usr-role"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Batasan Login (Peran)
                </label>
                <select
                  id="usr-role"
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="siswa">Siswa</option>
                  <option value="guru">Guru</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="usr-username"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  NIS / NIP / Username Login
                </label>
                <input
                  id="usr-username"
                  type="text"
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
                  placeholder="Contoh: 240905"
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label
                  htmlFor="usr-name"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Nama Lengkap
                </label>
                <input
                  id="usr-name"
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Contoh: Bagas Pratama"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label
                  htmlFor="usr-pass"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Kata Sandi
                </label>
                <input
                  id="usr-pass"
                  type="text"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                />
              </div>

              {formRole === 'siswa' ? (
                <div>
                  <label
                    htmlFor="usr-kelas"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Kelas
                  </label>
                  <input
                    id="usr-kelas"
                    type="text"
                    value={formKelas}
                    onChange={(e) => setFormKelas(e.target.value.toUpperCase())}
                    placeholder="Contoh: 9A"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              ) : (
                <div>
                  <label
                    htmlFor="usr-mapel"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    {formRole === 'guru' ? 'Mata Pelajaran Diampu' : 'Jabatan'}
                  </label>
                  <input
                    id="usr-mapel"
                    type="text"
                    list={formRole === 'guru' ? 'kartini-subject-suggestions' : undefined}
                    value={formMapel}
                    onChange={(e) => setFormMapel(e.target.value)}
                    placeholder="Contoh: IPA Terpadu"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                  {formRole === 'guru' && (
                    <datalist id="kartini-subject-suggestions">
                      <option value="Matematika" />
                      <option value="IPA Terpadu" />
                      <option value="Bahasa Indonesia" />
                      <option value="Bahasa Inggris" />
                      <option value="IPS Terpadu" />
                      <option value="PKn" />
                      <option value="Pendidikan Agama" />
                      <option value="Informatika" />
                      <option value="Literasi & Numerasi" />
                      <option value="PJOK" />
                      <option value="Seni Budaya" />
                    </datalist>
                  )}
                </div>
              )}
            </div>

            {userFormError && (
              <p role="alert" className="text-xs font-medium text-red-700">
                {userFormError}
              </p>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowUserModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                Simpan Akun
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Bulk Excel Import Modal */}
      {showImportModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-users-title"
          className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-3xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="import-users-title"
                  className="font-display text-lg font-bold text-slate-900"
                >
                  Import Data Pengguna dari Excel
                </h2>
                <p className="text-xs text-slate-600 mt-1">
                  Unduh templat Excel resmi, lengkapi data Siswa/Guru/Admin, lalu unggah kembali untuk impor massal.
                </p>
              </div>
              <button
                type="button"
                onClick={downloadUserImportTemplate}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Template Excel</span>
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                <FileSpreadsheet className="w-4 h-4 text-teal-700 shrink-0" />
                <span>Kolom Template: username, name, role (siswa/guru/admin), kelas, mapel, password, active</span>
              </div>

              <div>
                <label
                  htmlFor="import-excel-file"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Pilih File Excel (.xlsx, .xls, .csv)
                </label>
                <input
                  id="import-excel-file"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleImportFileChange}
                  className="block w-full text-xs text-slate-700 file:mr-3 file:py-2 file:px-3.5 file:rounded-lg file:border file:border-slate-300 file:text-xs file:font-semibold file:bg-white file:text-slate-800 hover:file:bg-slate-100 cursor-pointer"
                />
                {importFileName && (
                  <p className="mt-1.5 text-xs text-slate-500">
                    File dipilih: <span className="font-mono text-slate-800">{importFileName}</span>
                  </p>
                )}
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={importUpdateExisting}
                  onChange={(e) => setImportUpdateExisting(e.target.checked)}
                  className="accent-teal-700"
                />
                <span>Perbarui data akun apabila username (NIS/NIP) sudah terdaftar</span>
              </label>
            </div>

            {importFileError && (
              <div
                role="alert"
                className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-800"
              >
                {importFileError}
              </div>
            )}

            {importPreview && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <span className="font-semibold text-emerald-700">
                    Akun baru: <span className="font-mono tabular-nums">{importPreview.toInsert.length}</span>
                  </span>
                  <span className="font-semibold text-teal-700">
                    Pembaruan: <span className="font-mono tabular-nums">{importPreview.toUpdate.length}</span>
                  </span>
                  <span className="font-semibold text-amber-700">
                    Duplikat dilewati: <span className="font-mono tabular-nums">{importPreview.duplicateCount}</span>
                  </span>
                  <span className="font-semibold text-red-700">
                    Baris error: <span className="font-mono tabular-nums">{importPreview.errorCount}</span>
                  </span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                        <th className="py-2.5 px-3">Baris</th>
                        <th className="py-2.5 px-3">NIS/NIP</th>
                        <th className="py-2.5 px-3">Nama</th>
                        <th className="py-2.5 px-3">Peran</th>
                        <th className="py-2.5 px-3">Kelas / Mapel</th>
                        <th className="py-2.5 px-3">Validasi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {importPreview.previewRows.map((row) => (
                        <tr key={row.rowNumber} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-mono tabular-nums text-slate-500">
                            {row.rowNumber}
                          </td>
                          <td className="py-2 px-3 font-mono tabular-nums text-slate-800">
                            {row.username}
                          </td>
                          <td className="py-2 px-3 font-medium text-slate-900">
                            {row.name}
                          </td>
                          <td className="py-2 px-3 capitalize text-slate-700">
                            {row.role}
                          </td>
                          <td className="py-2 px-3 text-slate-600">
                            {row.role === 'siswa' ? `Kelas ${row.kelas}` : row.mapel}
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={
                                row.status === 'valid' || row.status === 'update'
                                  ? 'text-emerald-700 font-medium'
                                  : row.status === 'duplicate'
                                  ? 'text-amber-700 font-medium'
                                  : 'text-red-700 font-medium'
                              }
                            >
                              {row.message}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="button"
                disabled={
                  !importPreview ||
                  importPreview.toInsert.length + importPreview.toUpdate.length === 0
                }
                onClick={handleConfirmBulkImport}
                className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg cursor-pointer"
              >
                Impor{' '}
                {importPreview
                  ? importPreview.toInsert.length + importPreview.toUpdate.length
                  : 0}{' '}
                Pengguna
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
