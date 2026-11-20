import React, { useEffect, useState } from 'react';
import { BookOpen, KeyRound, LogOut, Menu, X } from 'lucide-react';
import type { User, UserRole } from '../types/exam';
import type { PortalTab } from '../utils/examEngine';

interface NavItem {
  id: PortalTab;
  label: string;
}

const ROLE_NAV_ITEMS: Record<UserRole, NavItem[]> = {
  siswa: [
    { id: 'siswa-ujian', label: 'Daftar Ujian' },
    { id: 'siswa-nilai', label: 'Riwayat Nilai' },
  ],
  guru: [
    { id: 'guru-progres', label: 'Pantau Progres' },
    { id: 'guru-soal', label: 'Bank Soal' },
    { id: 'guru-nilai', label: 'Kelola Nilai' },
    { id: 'guru-ai', label: 'Asisten AI' },
  ],
  admin: [
    { id: 'admin-pengguna', label: 'Data Pengguna' },
    { id: 'admin-kartu', label: 'Kartu Ujian' },
    { id: 'admin-jadwal', label: 'Jadwal Ujian' },
    { id: 'admin-laporan', label: 'Laporan & Nilai' },
    { id: 'admin-sistem', label: 'Fitur Sistem' },
  ],
};

const ROLE_LABELS: Record<UserRole, string> = {
  siswa: 'Siswa',
  guru: 'Guru',
  admin: 'Admin',
};

const DEFAULT_LOGO = './src/assets/images/kartini_crest_1795078071603.jpg';

interface TopBarProps {
  schoolName: string;
  logoUrl?: string;
  user: User;
  activeTab: PortalTab;
  onSelectTab: (tab: PortalTab) => void;
  onOpenChangePassword: () => void;
  onLogout: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  schoolName,
  logoUrl,
  user,
  activeTab,
  onSelectTab,
  onOpenChangePassword,
  onLogout,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [crestFailed, setCrestFailed] = useState(false);
  const navItems = ROLE_NAV_ITEMS[user.role];
  const resolvedLogo = logoUrl?.trim() || DEFAULT_LOGO;

  useEffect(() => {
    setCrestFailed(false);
  }, [resolvedLogo]);

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand wordmark */}
        <div className="flex items-center gap-3 min-w-0 shrink-0">
          <div className="w-8 h-8 rounded-md border border-slate-200 bg-slate-50 overflow-hidden shrink-0 flex items-center justify-center">
            {!crestFailed ? (
              <img
                src={resolvedLogo}
                alt={schoolName}
                referrerPolicy="no-referrer"
                onError={() => setCrestFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <BookOpen className="w-4 h-4 text-slate-900" />
            )}
          </div>
          <span className="font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            {schoolName}
          </span>
        </div>

        {/* Zone 2: Single-line navigation links */}
        <nav
          aria-label="Navigasi Utama"
          className="hidden md:flex items-center gap-6"
        >
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`py-2 text-sm font-medium whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-pointer ${
                  isActive
                    ? 'border-teal-600 text-slate-900 font-semibold'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Account summary + Change Password + Logout */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden lg:flex items-center gap-2 text-xs text-slate-600 whitespace-nowrap">
            <span className="font-semibold text-slate-900">{user.name}</span>
            <span aria-hidden="true">·</span>
            <span>
              {ROLE_LABELS[user.role]}
              {user.role === 'siswa' && user.kelas !== '-' ? ` · ${user.kelas}` : ''}
            </span>
          </div>

          <button
            type="button"
            onClick={onOpenChangePassword}
            className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <KeyRound className="w-3.5 h-3.5 text-teal-700" />
            <span>Ganti Password</span>
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="hidden md:inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar</span>
          </button>

          <button
            type="button"
            aria-label={mobileMenuOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="md:hidden p-2 text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-2">
          <div className="pb-2 border-b border-slate-100 text-xs text-slate-600">
            <span className="font-semibold text-slate-900">{user.name}</span>
            {' · '}
            <span>
              {ROLE_LABELS[user.role]}
              {user.role === 'siswa' && user.kelas !== '-' ? ` · ${user.kelas}` : ''}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2.5 text-sm font-medium rounded-lg cursor-pointer ${
                    isActive
                      ? 'bg-teal-50 text-teal-800 font-semibold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenChangePassword();
              }}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5 text-teal-700" />
              <span>Ganti Password</span>
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
