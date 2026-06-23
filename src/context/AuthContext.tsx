// ============================================================================
// AuthContext — owns the authenticated session.
// - Bootstraps from a persisted JWT (re-validates against /auth/validate).
// - Exposes login/logout and the current PublicUser + derived role helpers.
// - Registers a global 401 handler so any expired token forces a clean logout.
// ============================================================================

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { PublicUser, UserRole } from '../types';
import {
  api,
  setAuthToken,
  getAuthToken,
  setUnauthorizedHandler,
  ApiError,
} from '../api/client';

interface AuthContextValue {
  user: PublicUser | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean; // true while we re-validate a stored token
  isLoggingIn: boolean;
  loginError: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  // Role helpers (admin implicitly has it_support powers).
  isAdmin: boolean;
  isITSupport: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState<boolean>(!!getAuthToken());
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const logout = useCallback(() => {
    setAuthToken(null);
    setUser(null);
  }, []);

  // Any 401 anywhere in the app clears the session.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setAuthToken(null);
      setUser(null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  // Re-hydrate a persisted token on first mount.
  useEffect(() => {
    let cancelled = false;
    const token = getAuthToken();
    if (!token) {
      setIsBootstrapping(false);
      return;
    }
    api
      .validate()
      .then((res) => {
        if (!cancelled) setUser(res.user);
      })
      .catch(() => {
        if (!cancelled) {
          setAuthToken(null);
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) setIsBootstrapping(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const res = await api.login(email, password);
      setAuthToken(res.token);
      setUser(res.user);
      return true;
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Login failed. Please try again.';
      setLoginError(msg);
      return false;
    } finally {
      setIsLoggingIn(false);
    }
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const role: UserRole | undefined = user?.role;
    return {
      user,
      isAuthenticated: !!user,
      isBootstrapping,
      isLoggingIn,
      loginError,
      login,
      logout,
      isAdmin: role === 'admin',
      isITSupport: role === 'admin' || role === 'it_support',
    };
  }, [user, isBootstrapping, isLoggingIn, loginError, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
