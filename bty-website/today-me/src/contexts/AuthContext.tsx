"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  clearStoredToken,
  fetchSession,
  getStoredToken,
  readTokenFromHash,
  setStoredToken,
} from "@/lib/auth-client";
import type { AuthUser } from "@/lib/auth-client";

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
};

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSession = useCallback(async () => {
    const tokenFromHash = readTokenFromHash();
    if (tokenFromHash) {
      setStoredToken(tokenFromHash);
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    }
    const token = tokenFromHash || getStoredToken();
    const u = await fetchSession(token);
    setUser(u);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const login = useCallback(
    async (email: string, password: string) => {
      setError(null);
      try {
        const { login: doLogin } = await import("@/lib/auth-client");
        const { token, user: u } = await doLogin(email, password);
        setStoredToken(token);
        setUser(u);
      } catch (e) {
        setError(e instanceof Error ? e.message : "로그인에 실패했어요.");
        throw e;
      }
    },
    []
  );

  const register = useCallback(
    async (email: string, password: string) => {
      setError(null);
      try {
        const { register: doRegister } = await import("@/lib/auth-client");
        const { token, user: u } = await doRegister(email, password);
        setStoredToken(token);
        setUser(u);
      } catch (e) {
        setError(e instanceof Error ? e.message : "회원가입에 실패했어요.");
        throw e;
      }
    },
    []
  );

  const logout = useCallback(() => {
    clearStoredToken();
    setUser(null);
  }, []);

  const value: AuthContextValue = {
    user,
    loading,
    error,
    login,
    register,
    logout,
    clearError: () => setError(null),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
