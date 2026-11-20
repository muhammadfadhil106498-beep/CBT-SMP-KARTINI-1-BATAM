import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  CheckSquare,
  CreditCard,
  Printer,
  Search,
  Square,
} from 'lucide-react';
import type { Exam, SystemSettings, User } from '../types/exam';

interface ExamCardPrinterProps {
  users: User[];
  exams: Exam[];
  settings: SystemSettings;
}

const DEFAULT_LOGO = './src/assets/images/kartini_crest_1795078071603.jpg';

export const ExamCardPrinter: React.FC<ExamCardPrinterProps> = ({
  users,
  exams,
  settings,
}) => {
  const defaultExam =
    exams.find((e) => e.status === 'berlangsung') ?? exams[0] ?? null;

  const [selectedExamId, setSelectedExamId] = useState<string>(
    defaultExam?.id ?? 'custom'
  );
  const [customExamName, setCustomExamName] = useState(
    'Penilaian Akhir Semester (PAS)'
  );
  const [classFilter, setClassFilter] = useState<string>('semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyActive, setOnlyActive] = useState(true);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [logoFailed, setLogoFailed] = useState(false);

  const resolvedLogo = settings.logoUrl?.trim() || DEFAULT_LOGO;

  useEffect(() => {
    setLogoFailed(false);
  }, [resolvedLogo]);

  const students = useMemo(
    () =>
      users
        .filter((u) => u.role === 'siswa')
        .sort((a, b) => {
          const cmpClass = a.kelas.localeCompare(b.kelas, 'id', {
            numeric: true,
          });
          if (cmpClass !== 0) return cmpClass;
          return a.name.localeCompare(b.name, 'id');
        }),
    [users]
  );

  const availableClasses = useMemo(() => {
    const set = new Set<string>();
    for (const st of students) {
      if (st.kelas && st.kelas !== '-') set.add(st.kelas.trim().toUpperCase());
    }
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, 'id', { numeric: true })
    );
  }, [students]);

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return students.filter((st) => {
      if (onlyActive && !st.active) return false;
      if (
        classFilter !== 'semua' &&
        st.kelas.trim().toUpperCase() !== classFilter
      ) {
        return false;
      }
      if (q) {
        const hay = `${st.name} ${st.username} ${st.kelas}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [students, onlyActive, classFilter, searchQuery]);

  const selectedExam = useMemo(
    () =>
      selectedExamId === 'custom'
        ? null
        : exams.find((ex) => ex.id === selectedExamId) ?? null,
    [exams, selectedExamId]
  );

  const examTitleOnCard = selectedExam
    ? selectedExam.title
    : customExamName.trim() || 'Ujian Sekolah Berbasis Komputer';

  const studentsToPrint = useMemo(() => {
    if (selectedStudentIds.length === 0) return filteredStudents;
    const selectedSet = new Set(selectedStudentIds);
    return filteredStudents.filter((s) => selectedSet.has(s.id));
  }, [filteredStudents, selectedStudentIds]);

  const toggleStudentSelection = (id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAllFiltered = () => {
    setSelectedStudentIds(filteredStudents.map((s) => s.id));
  };

  const clearSelection = () => {
    setSelectedStudentIds([]);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Control Header (Hidden during print) */}
      <div className="no-print flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-teal-700 mb-1">
            Ukuran Standar Kartu Debit / ID Card (CR80: 85,6 mm × 53,98 mm)
          </p>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Cetak Kartu Peserta Ujian
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Siapkan kartu identitas ujian ukuran kartu ATM/ID standar lengkap dengan logo sekolah, nama sekolah, nama ujian, dan data peserta.
          </p>
        </div>

        <button
          type="button"
          disabled={studentsToPrint.length === 0}
          onClick={handlePrint}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-700 hover:bg-teal-800 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          <span>Print Kartu Ujian ({studentsToPrint.length})</span>
        </button>
      </div>

      {/* Filters & Card Options (Hidden during print) */}
      <section className="no-print bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-5">
            <label
              htmlFor="card-exam-select"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Nama Ujian yang Dicetak di Kartu
            </label>
            <select
              id="card-exam-select"
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
            >
              {exams.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.title} ({ex.token})
                </option>
              ))}
              <option value="custom">Tulis Nama Ujian Kustom (Umum)</option>
            </select>
          </div>

          {selectedExamId === 'custom' && (
            <div className="md:col-span-4">
              <label
                htmlFor="card-custom-exam"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Judul Ujian Kustom
              </label>
              <input
                id="card-custom-exam"
                type="text"
                value={customExamName}
                onChange={(e) => setCustomExamName(e.target.value)}
                placeholder="Misal: Penilaian Akhir Semester Ganjil"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
              />
            </div>
          )}

          <div className={selectedExamId === 'custom' ? 'md:col-span-3' : 'md:col-span-3'}>
            <label
              htmlFor="card-class-filter"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Filter Kelas
            </label>
            <select
              id="card-class-filter"
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
            >
              <option value="semua">Semua Kelas</option>
              {availableClasses.map((cls) => (
                <option key={cls} value={cls}>
                  Kelas {cls}
                </option>
              ))}
            </select>
          </div>

          <div className={selectedExamId === 'custom' ? 'md:col-span-12' : 'md:col-span-4'}>
            <label
              htmlFor="card-student-search"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Cari Peserta
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="card-student-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama atau No. Peserta..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg"
              />
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyActive}
                onChange={(e) => setOnlyActive(e.target.checked)}
                className="accent-teal-700"
              />
              <span>Hanya siswa berstatus Aktif</span>
            </label>
            <span className="text-slate-500 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-teal-700" />
              <span>
                Dimensi cetak CR80:{' '}
                <strong className="font-mono text-slate-800">
                  85.6mm × 53.98mm
                </strong>{' '}
                (muat 8 kartu per lembar A4)
              </span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={selectAllFiltered}
              className="px-3 py-1.5 font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
            >
              Pilih Semua ({filteredStudents.length})
            </button>
            {selectedStudentIds.length > 0 && (
              <button
                type="button"
                onClick={clearSelection}
                className="px-3 py-1.5 font-semibold text-slate-600 hover:text-slate-900 underline cursor-pointer"
              >
                Reset Pilihan ({selectedStudentIds.length} dipilih)
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Printable Cards Sheet */}
      {filteredStudents.length === 0 ? (
        <div className="no-print bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-600">
          Tidak ada data siswa yang cocok dengan filter pencarian.
        </div>
      ) : (
        <div className="space-y-4">
          <p className="no-print text-xs text-slate-500">
            Klik kartu untuk memilih peserta tertentu yang akan dicetak, atau langsung tekan tombol <strong>Print Kartu Ujian</strong> untuk mencetak seluruh kartu terfilter.
          </p>

          <div className="exam-cards-print-grid grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 justify-items-center">
            {filteredStudents.map((student) => {
              const isSelected = selectedStudentIds.includes(student.id);
              const isExcludedBySelection =
                selectedStudentIds.length > 0 && !isSelected;

              return (
                <div
                  key={student.id}
                  className={`flex flex-col items-center gap-2 ${
                    isExcludedBySelection ? 'no-print opacity-45' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleStudentSelection(student.id)}
                    aria-pressed={isSelected}
                    aria-label={`Pilih kartu ujian ${student.name}`}
                    className="no-print inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-3.5 h-3.5 text-teal-700" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-slate-400" />
                    )}
                    <span>
                      {isSelected ? 'Terpilih untuk cetak' : 'Pilih kartu ini'}
                    </span>
                  </button>

                  {/* Standard Debit / ID Card CR80 (85.6mm x 53.98mm) */}
                  <article
                    className={`exam-id-card bg-white border rounded-lg overflow-hidden flex flex-col justify-between shadow-sm ${
                      isSelected
                        ? 'border-teal-700 ring-2 ring-teal-600/20 print:ring-0 print:border-slate-400'
                        : 'border-slate-300'
                    }`}
                  >
                    {/* Card Header: School Logo & Name */}
                    <div className="bg-slate-900 text-white px-3 py-1.5 flex items-center gap-2 border-b-2 border-teal-500">
                      <div className="w-7 h-7 rounded bg-white border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                        {!logoFailed ? (
                          <img
                            src={resolvedLogo}
                            alt={settings.schoolName}
                            referrerPolicy="no-referrer"
                            onError={() => setLogoFailed(true)}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <BookOpen className="w-4 h-4 text-slate-900" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 leading-tight">
                        <p className="font-display text-[10px] font-bold tracking-wide uppercase truncate">
                          {settings.schoolName}
                        </p>
                        <p className="text-[8px] text-slate-300 truncate">
                          Kartu Peserta Ujian · TA {settings.academicYear} ({settings.semester})
                        </p>
                      </div>
                    </div>

                    {/* Card Body: Exam Name & Full Participant Information */}
                    <div className="px-3 py-1.5 flex-1 flex flex-col justify-between gap-1 text-slate-900">
                      <div className="border-b border-slate-200 pb-1">
                        <p className="text-[7.5px] font-semibold uppercase tracking-wider text-teal-800">
                          Nama Ujian
                        </p>
                        <p className="font-display text-[9.5px] font-bold text-slate-900 leading-tight line-clamp-1">
                          {examTitleOnCard}
                        </p>
                        {selectedExam && (
                          <p className="text-[8px] text-slate-600 truncate">
                            Mapel: {selectedExam.subject} · Ruang: {selectedExam.room}
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-12 gap-x-2 gap-y-0.5 text-[8.5px] leading-tight">
                        <span className="col-span-4 text-slate-500">Nama Peserta</span>
                        <span className="col-span-8 font-bold text-slate-900 truncate">
                          : {student.name}
                        </span>

                        <span className="col-span-4 text-slate-500">No. Peserta</span>
                        <span className="col-span-8 font-mono font-bold tabular-nums text-slate-900 truncate">
                          : {student.username}
                        </span>

                        <span className="col-span-4 text-slate-500">Kelas</span>
                        <span className="col-span-8 font-semibold text-slate-900 truncate">
                          : {student.kelas}
                        </span>

                        <span className="col-span-4 text-slate-500">
                          {selectedExam ? 'Kode Ujian' : 'Status'}
                        </span>
                        <span className="col-span-8 font-mono font-bold tabular-nums text-teal-800 truncate">
                          :{' '}
                          {selectedExam
                            ? `${selectedExam.token} · ${student.active ? 'Aktif' : 'Nonaktif'}`
                            : student.active
                            ? 'Peserta Aktif'
                            : 'Nonaktif'}
                        </span>
                      </div>
                    </div>

                    {/* Card Footer */}
                    <div className="px-3 py-1 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 text-[7.5px] text-slate-600">
                      <span className="font-mono tabular-nums truncate">
                        NPSN {settings.npsn}
                      </span>
                      <span className="font-semibold text-slate-700 whitespace-nowrap">
                        Panitia Ujian CBT
                      </span>
                    </div>
                  </article>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
