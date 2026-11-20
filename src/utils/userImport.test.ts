import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {
  buildUserImportTemplateWorkbook,
  parseImportedUserRows,
} from './userImport';
import type { User } from '../types/exam';

const existingUsers: User[] = [
  {
    id: 'u-1',
    username: '240901',
    password: '123',
    name: 'Alya Putri Lestari',
    role: 'siswa',
    kelas: '9A',
    active: true,
    createdAt: '2026-08-01T00:00:00Z',
  },
];

test('parseImportedUserRows validates roles, aliases, duplicates, and errors', () => {
  const rows = [
    {
      NIS: '240910',
      'Nama Lengkap': 'Farah Diba',
      Peran: 'Siswa',
      Kelas: '9b',
      'Kata Sandi': 'pass99',
      Status: 'aktif',
    },
    {
      username: '240901',
      name: 'Alya Duplikat',
      role: 'siswa',
      kelas: '9A',
    },
    {
      username: '240911',
      name: 'Salah Peran',
      role: 'kepsek',
    },
    {
      username: 'guru.ing',
      name: 'Dewi Anggraini',
      role: 'guru',
      mapel: 'Bahasa Inggris',
      active: 'nonaktif',
    },
  ];

  const skippedMode = parseImportedUserRows(rows, existingUsers, {
    updateExisting: false,
  });
  assert.equal(skippedMode.toInsert.length, 2);
  assert.equal(skippedMode.toUpdate.length, 0);
  assert.equal(skippedMode.duplicateCount, 1);
  assert.equal(skippedMode.errorCount, 1);
  assert.equal(skippedMode.toInsert[0].kelas, '9B');
  assert.equal(skippedMode.toInsert[1].active, false);

  const updateMode = parseImportedUserRows(rows, existingUsers, {
    updateExisting: true,
  });
  assert.equal(updateMode.toInsert.length, 2);
  assert.equal(updateMode.toUpdate.length, 1);
  assert.equal(updateMode.toUpdate[0].id, 'u-1');
  assert.equal(updateMode.toUpdate[0].name, 'Alya Duplikat');
});

test('buildUserImportTemplateWorkbook produces readable Excel sheets', () => {
  const wb = buildUserImportTemplateWorkbook();
  assert.deepEqual(wb.SheetNames, ['Data Pengguna', 'Panduan Pengisian']);

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const parsedWb = XLSX.read(buffer, { type: 'buffer' });
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    parsedWb.Sheets['Data Pengguna']
  );

  assert.equal(rows.length, 3);
  const result = parseImportedUserRows(rows, existingUsers);
  assert.equal(result.errorCount, 0);
  assert.equal(result.toInsert.length, 3);
});
