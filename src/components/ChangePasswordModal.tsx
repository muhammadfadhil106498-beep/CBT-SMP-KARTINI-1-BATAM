import React, { useState } from 'react';
import { CheckCircle2, Eye, EyeOff, KeyRound, X } from 'lucide-react';
import type { User } from '../types/exam';
import { changeUserPassword } from '../utils/examEngine';

interface ChangePasswordModalProps {
  users: User[];
  lockedUsername?: string;
  onPasswordChanged: (updatedUser: User, updatedUsers: User[]) => void;
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  users,
  lockedUsername,
  onPasswordChanged,
  onClose,
}) => {
  const [username, setUsername] = useState(lockedUsername ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = changeUserPassword(
      users,
      lockedUsername ?? username,
      currentPassword,
      newPassword,
      confirmPassword
    );
    if (res.error || !res.updatedUser || !res.updatedUsers) {
      setErrorMsg(res.error ?? 'Gagal mengubah kata sandi.');
      setSuccessMsg(null);
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(`Kata sandi untuk ${res.updatedUser.name} berhasil diperbarui.`);
    onPasswordChanged(res.updatedUser, res.updatedUsers);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-password-title"
      className="fixed inset-0 z-50 bg-slate-950/55 flex items-center justify-center p-4"
    >
      <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
              <KeyRound className="w-5 h-5 text-slate-800" />
            </div>
            <div>
              <h2
                id="change-password-title"
                className="font-display text-lg font-bold text-slate-900"
              >
                Ganti Kata Sandi
              </h2>
              <p className="text-xs text-slate-500">
                Berlaku untuk akun Siswa, Guru, maupun Admin sekolah.
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="Tutup modal ganti password"
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
          <div>
            <label
              htmlFor="cp-username"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              NIS / NIP / ID Pengguna
            </label>
            <input
              id="cp-username"
              type="text"
              value={lockedUsername ?? username}
              disabled={Boolean(lockedUsername)}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Contoh: 240901, guru.mtk, atau admin"
              className="w-full px-3.5 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg disabled:bg-slate-100 disabled:text-slate-600 focus:outline-none focus:border-teal-600"
            />
          </div>

          <div>
            <label
              htmlFor="cp-current"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Kata Sandi Lama
            </label>
            <input
              id="cp-current"
              type={showPasswords ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Masukkan kata sandi saat ini"
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
            />
          </div>

          <div>
            <label
              htmlFor="cp-new"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Kata Sandi Baru (minimal 3 karakter)
            </label>
            <input
              id="cp-new"
              type={showPasswords ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Masukkan kata sandi baru"
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
            />
          </div>

          <div>
            <label
              htmlFor="cp-confirm"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Konfirmasi Kata Sandi Baru
            </label>
            <input
              id="cp-confirm"
              type={showPasswords ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Ulangi kata sandi baru"
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowPasswords((prev) => !prev)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            {showPasswords ? (
              <EyeOff className="w-3.5 h-3.5" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
            <span>{showPasswords ? 'Sembunyikan sandi' : 'Tampilkan sandi'}</span>
          </button>

          {errorMsg && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-800"
            >
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div
              role="status"
              className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-900 flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              Tutup
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
            >
              Simpan Password Baru
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
