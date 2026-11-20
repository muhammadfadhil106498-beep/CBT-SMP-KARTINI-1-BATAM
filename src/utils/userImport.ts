import * as XLSX from 'xlsx';
import type { User, UserRole } from '../types/exam';

export interface ImportPreviewRow {
  rowNumber: number;
  username: string;
  name: string;
  role: UserRole | string;
  kelas: string;
  mapel: string;
  status: 'valid' | 'update' | 'duplicate' | 'error';
  message: string;
  parsedUser?: User;
}

export interface UserImportResult {
  toInsert: User[];
  toUpdate: User[];
  previewRows: ImportPreviewRow[];
  errorCount: number;
  duplicateCount: number;
}

const VALID_ROLES: UserRole[] = ['siswa', 'guru', 'admin'];

function normalizeKey(key: string): string {
  return key
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function pickField(
  row: Record<string, unknown>,
  aliases: string[]
): string {
  const entries = Object.entries(row);
  for (const alias of aliases) {
    const target = normalizeKey(alias);
    const found = entries.find(([k]) => normalizeKey(k) === target);
    if (found && found[1] !== undefined && found[1] !== null) {
      return String(found[1]).trim();
    }
  }
  return '';
}

function parseActiveFlag(raw: string): boolean {
  if (!raw) return true;
  const norm = raw.trim().toLowerCase();
  if (
    norm === 'nonaktif' ||
    norm === 'tidak' ||
    norm === 'false' ||
    norm === '0' ||
    norm === 'no'
  ) {
    return false;
  }
  return true;
}

export function parseImportedUserRows(
  rawRows: Record<string, unknown>[],
  existingUsers: User[],
  options: { updateExisting?: boolean } = {}
): UserImportResult {
  const updateExisting = Boolean(options.updateExisting);
  const existingByUsername = new Map<string, User>();
  for (const u of existingUsers) {
    existingByUsername.set(u.username.trim().toLowerCase(), u);
  }

  const seenInFile = new Set<string>();
  const toInsert: User[] = [];
  const toUpdate: User[] = [];
  const previewRows: ImportPreviewRow[] = [];
  let errorCount = 0;
  let duplicateCount = 0;

  rawRows.forEach((raw, idx) => {
    const rowNumber = idx + 2; // Excel row 1 is header
    const username = pickField(raw, [
      'username',
      'nis',
      'nip',
      'nis/nip',
      'id',
      'id_pengguna',
    ]);
    const name = pickField(raw, ['name', 'nama', 'nama_lengkap', 'namalengkap']);
    const rawRole = pickField(raw, ['role', 'peran', 'akses']).toLowerCase();
    const kelas = pickField(raw, ['kelas', 'class', 'rombel']);
    const mapel = pickField(raw, ['mapel', 'mata_pelajaran', 'jabatan']);
    const password =
      pickField(raw, ['password', 'kata_sandi', 'katasandi', 'sandi']) || '123';
    const rawActive = pickField(raw, ['active', 'status', 'aktif']);

    // Ignore completely blank rows
    if (!username && !name && !rawRole && !kelas && !mapel) {
      return;
    }

    if (!username || !name) {
      errorCount += 1;
      previewRows.push({
        rowNumber,
        username: username || '-',
        name: name || '-',
        role: rawRole || '-',
        kelas: kelas || '-',
        mapel: mapel || '-',
        status: 'error',
        message: 'Kolom username (NIS/NIP) dan nama lengkap wajib diisi.',
      });
      return;
    }

    if (!VALID_ROLES.includes(rawRole as UserRole)) {
      errorCount += 1;
      previewRows.push({
        rowNumber,
        username,
        name,
        role: rawRole || '-',
        kelas: kelas || '-',
        mapel: mapel || '-',
        status: 'error',
        message: `Peran "${rawRole || '(kosong)'}" tidak valid. Gunakan siswa, guru, atau admin.`,
      });
      return;
    }

    const role = rawRole as UserRole;
    const normUsername = username.toLowerCase();

    if (seenInFile.has(normUsername)) {
      duplicateCount += 1;
      previewRows.push({
        rowNumber,
        username,
        name,
        role,
        kelas: role === 'siswa' ? kelas || '7A' : '-',
        mapel: mapel || '-',
        status: 'duplicate',
        message: 'Username duplikat di dalam file Excel ini (dilewati).',
      });
      return;
    }
    seenInFile.add(normUsername);

    const active = parseActiveFlag(rawActive);
    const normalizedKelas = role === 'siswa' ? (kelas || '7A').toUpperCase() : '-';
    const normalizedMapel =
      role === 'guru' ? mapel || 'Umum' : role === 'admin' ? mapel || 'Administrator' : undefined;

    const existing = existingByUsername.get(normUsername);
    if (existing) {
      if (!updateExisting) {
        duplicateCount += 1;
        previewRows.push({
          rowNumber,
          username,
          name,
          role,
          kelas: normalizedKelas,
          mapel: normalizedMapel ?? '-',
          status: 'duplicate',
          message: 'Akun sudah terdaftar (dilewati).',
        });
        return;
      }

      const updated: User = {
        ...existing,
        username,
        name,
        password,
        role,
        kelas: normalizedKelas,
        mapel: normalizedMapel,
        active,
      };
      toUpdate.push(updated);
      previewRows.push({
        rowNumber,
        username,
        name,
        role,
        kelas: normalizedKelas,
        mapel: normalizedMapel ?? '-',
        status: 'update',
        message: 'Memperbarui data akun yang sudah ada.',
        parsedUser: updated,
      });
      return;
    }

    const created: User = {
      id: `usr-imp-${Date.now()}-${idx}`,
      username,
      password,
      name,
      role,
      kelas: normalizedKelas,
      mapel: normalizedMapel,
      active,
      createdAt: new Date().toISOString(),
    };
    toInsert.push(created);
    previewRows.push({
      rowNumber,
      username,
      name,
      role,
      kelas: normalizedKelas,
      mapel: normalizedMapel ?? '-',
      status: 'valid',
      message: 'Siap diimpor sebagai akun baru.',
      parsedUser: created,
    });
  });

  return {
    toInsert,
    toUpdate,
    previewRows,
    errorCount,
    duplicateCount,
  };
}

export function buildUserImportTemplateWorkbook(): XLSX.WorkBook {
  const templateRows = [
    {
      username: '240910',
      name: 'Farah Diba',
      role: 'siswa',
      kelas: '9A',
      mapel: '',
      password: '123',
      active: 'aktif',
    },
    {
      username: '240812',
      name: 'Kevin Pratama',
      role: 'siswa',
      kelas: '8B',
      mapel: '',
      password: '123',
      active: 'aktif',
    },
    {
      username: 'guru.ing',
      name: 'Dewi Anggraini, S.Pd',
      role: 'guru',
      kelas: '-',
      mapel: 'Bahasa Inggris',
      password: '123',
      active: 'aktif',
    },
  ];

  const guideRows = [
    { Kolom: 'username', Wajib: 'Ya', Keterangan: 'NIS untuk siswa, NIP atau ID unik untuk guru/admin' },
    { Kolom: 'name', Wajib: 'Ya', Keterangan: 'Nama lengkap pengguna' },
    { Kolom: 'role', Wajib: 'Ya', Keterangan: 'Isi salah satu: siswa, guru, atau admin' },
    { Kolom: 'kelas', Wajib: 'Jika siswa', Keterangan: 'Contoh: 7A, 8B, 9A (isi - untuk guru/admin)' },
    { Kolom: 'mapel', Wajib: 'Opsional', Keterangan: 'Mata pelajaran untuk guru atau jabatan untuk admin' },
    { Kolom: 'password', Wajib: 'Opsional', Keterangan: 'Kata sandi awal (default 123 jika dikosongkan)' },
    { Kolom: 'active', Wajib: 'Opsional', Keterangan: 'Isi aktif atau nonaktif (default aktif)' },
  ];

  const wb = XLSX.utils.book_new();
  const wsUsers = XLSX.utils.json_to_sheet(templateRows);
  wsUsers['!cols'] = [
    { wch: 16 },
    { wch: 26 },
    { wch: 10 },
    { wch: 10 },
    { wch: 20 },
    { wch: 12 },
    { wch: 12 },
  ];

  const wsGuide = XLSX.utils.json_to_sheet(guideRows);
  wsGuide['!cols'] = [{ wch: 14 }, { wch: 14 }, { wch: 56 }];

  XLSX.utils.book_append_sheet(wb, wsUsers, 'Data Pengguna');
  XLSX.utils.book_append_sheet(wb, wsGuide, 'Panduan Pengisian');
  return wb;
}

export function downloadUserImportTemplate(): void {
  const wb = buildUserImportTemplateWorkbook();
  XLSX.writeFile(wb, 'template-import-user-smp-kartini-1-batam.xlsx');
}

export async function readSpreadsheetRows(
  file: File
): Promise<Record<string, unknown>[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('File Excel tidak memiliki lembar kerja (sheet).');
  }
  const sheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
  });
}
