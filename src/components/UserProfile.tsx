// ============================================================================
// UserProfile — dropdown panel anchored in the header.
// Shows the authenticated user's identity/role, a dark-mode toggle, and logout.
// ============================================================================

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { LogOut, Moon, Sun, ChevronDown, ShieldCheck, Briefcase } from 'lucide-react';
import type { UserRole } from '../types';

const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Administrator',
  it_support: 'IT Support Specialist',
  requester: 'Requester',
};

const ROLE_BADGE: Record<UserRole, string> = {
  admin: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
  it_support: 'bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-300',
  requester: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

export default function UserProfile() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (!user) return null;

  const initials = user.fullName
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
      >
        <span className="w-7 h-7 rounded-md bg-violet-600 text-white text-[11px] font-extrabold flex items-center justify-center">
          {initials}
        </span>
        <span className="hidden sm:flex flex-col items-start leading-none">
          <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{user.fullName}</span>
          <span className="text-[9px] text-slate-400 font-mono uppercase tracking-wider mt-0.5">
            {ROLE_LABEL[user.role]}
          </span>
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl z-50 overflow-hidden animate-fade-in-smooth"
        >
          <div className="p-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <span className="w-11 h-11 rounded-lg bg-violet-600 text-white text-sm font-extrabold flex items-center justify-center shrink-0">
                {initials}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{user.fullName}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${ROLE_BADGE[user.role]}`}>
                <ShieldCheck className="w-3 h-3" /> {ROLE_LABEL[user.role]}
              </span>
              {user.department && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  <Briefcase className="w-3 h-3" /> {user.department}
                </span>
              )}
            </div>
            {user.title && (
              <p className="mt-2 text-[10px] text-slate-400 italic">{user.title}</p>
            )}
          </div>

          <div className="p-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={toggleTheme}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-violet-600" />}
              {theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                logout();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
