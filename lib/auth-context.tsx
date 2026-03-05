"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { clearCredentials, isAuthenticated, login as apiLogin } from "./api";

interface AuthContextType {
  authenticated: boolean;
  initializing: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    setAuthenticated(isAuthenticated());
    setInitializing(false);
  }, []);

  async function login(username: string, password: string) {
    await apiLogin(username, password);
    setAuthenticated(true);
  }

  function logout() {
    clearCredentials();
    setAuthenticated(false);
  }

  return (
    <AuthContext.Provider value={{ authenticated, initializing, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
