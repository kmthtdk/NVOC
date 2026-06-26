// ============================================================================
// Login — full-screen authentication gate.
// Submits credentials to the backend via AuthContext.login. Surfaces validation
// and auth errors inline, shows a spinner while in flight, and offers one-click
// demo accounts seeded by the backend.
// ============================================================================

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Spinner } from './ui/Spinner';
import { Database, Lock, Mail, AlertCircle, Sparkles } from 'lucide-react';

// Demo mode is controlled via VITE_DEMO_MODE environment variable.
// In production, this should be 'false' to hide demo accounts entirely.
const DEMO_MODE_ENABLED = import.meta.env.VITE_DEMO_MODE === 'true';

const DEMO_ACCOUNTS = [
  { email: 'admin@company.com', label: 'Admin', role: 'admin' },
  { email: 'marcus.vance@company.com', label: 'IT Support', role: 'it_support' },
  { email: 'alex.mercer@company.com', label: 'Requester', role: 'requester' },
];

// Password is from environment variable in development/demo, should be
// configured securely in production or demo mode should be disabled.
const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD || 'Passw0rd!';

export default function Login() {
  const { login, isLoggingIn, loginError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (!email.trim() || !password) {
      setLocalError('Please enter both your email and password.');
      return;
    }
    await login(email.trim(), password);
  };

  const fillDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword(DEMO_PASSWORD);
    setLocalError(null);
  };

  const error = localError ?? loginError;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 font-sans antialiased">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="p-3 bg-violet-600 rounded-2xl text-white shadow-lg shadow-violet-600/20 mb-4">
            <Database className="w-7 h-7 stroke-[2]" />
          </div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight uppercase">
            N-VOC System
          </h1>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest font-mono mt-1">
            Service Requests &amp; Tracking Console
          </p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl p-7 sm:p-8">
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight mb-1">
            Sign in
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
            Authenticate to access the request portal and tracking console.
          </p>

          {error && (
            <div
              role="alert"
              className="mb-5 p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl flex items-start gap-2.5 text-rose-800 dark:text-rose-200"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="text-xs font-semibold leading-relaxed">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="login-email" className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider font-mono">
                Corporate Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full text-sm pl-9 pr-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-100/50 focus:border-violet-600 transition-all"
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider font-mono">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full text-sm pl-9 pr-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-100/50 focus:border-violet-600 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-violet-600 hover:bg-violet-700 active:bg-violet-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-extrabold text-sm shadow-sm transition-all cursor-pointer"
            >
              {isLoggingIn ? <Spinner label="Signing in…" /> : 'Sign in'}
            </button>
          </form>

          {/* Demo accounts section (only shown when VITE_DEMO_MODE=true) */}
          {DEMO_MODE_ENABLED && (
            <div className="mt-7 pt-5 border-t border-slate-150 dark:border-slate-800">
              <p className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono mb-2.5">
                <Sparkles className="w-3 h-3 text-violet-500" /> Demo accounts
              </p>
              <div className="grid grid-cols-3 gap-2">
                {DEMO_ACCOUNTS.map((acct) => (
                  <button
                    key={acct.email}
                    type="button"
                    onClick={() => fillDemo(acct.email)}
                    className="px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-violet-400 hover:bg-violet-50 dark:hover:bg-slate-700 text-[10px] font-bold text-slate-600 dark:text-slate-300 transition-all cursor-pointer"
                  >
                    {acct.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-[10px] text-slate-400 mt-6 font-mono">
          Restricted access · Authorized personnel only
        </p>
      </div>
    </div>
  );
}
