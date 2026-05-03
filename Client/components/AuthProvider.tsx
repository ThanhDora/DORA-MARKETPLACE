"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ApiError, requestJson, type ApiEnvelope, type RequestJsonInit, type User } from "@/lib/api";

type AuthContextValue = {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { name: string; email: string; password: string; role?: string }) => Promise<string>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<string | null>;
  apiFetch: <T>(path: string, init?: RequestJsonInit) => Promise<T>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type LoginResponse = {
  user: User;
  accessToken: string;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const tokenRef = useRef<string | null>(null);
  const refreshPromise = useRef<Promise<string | null> | null>(null);
  const refreshBlockedUntil = useRef(0);

  const setSession = useCallback((nextUser: User | null, nextToken: string | null) => {
    setUser(nextUser);
    setAccessToken(nextToken);
    tokenRef.current = nextToken;
    if (nextUser && nextToken && typeof window !== "undefined") {
      window.sessionStorage.setItem("auth_was_authenticated", "1");
    }
  }, []);

  const refreshSession = useCallback(async () => {
    if (Date.now() < refreshBlockedUntil.current) {
      return null;
    }

    if (refreshPromise.current) {
      return refreshPromise.current;
    }

    refreshPromise.current = (async () => {
      let shouldReset = true;
      try {
        const response = await requestJson<ApiEnvelope<{ accessToken: string; user: User }>>("/auth/refresh", {
          method: "POST",
        });
        setSession(response.data.user, response.data.accessToken);
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem("auth_was_authenticated", "1");
        }
        return response.data.accessToken;
      } catch (error) {
        if (error instanceof ApiError) {
          if (error.status === 401 || error.status === 403) {
            setSession(null, null);
            refreshBlockedUntil.current = Date.now() + 30_000;
            if (typeof window !== "undefined") {
              window.sessionStorage.removeItem("auth_was_authenticated");
            }
          }
          if (error.status === 429) {
            shouldReset = false;
            refreshBlockedUntil.current = Date.now() + 60_000;
            setTimeout(() => {
              refreshPromise.current = null;
            }, 30_000);
          }
        }
        return null;
      } finally {
        if (shouldReset) {
          refreshPromise.current = null;
        }
      }
    })();

    return refreshPromise.current;
  }, [setSession]);

  useEffect(() => {
    const wasAuthenticated =
      typeof window !== "undefined" && window.sessionStorage.getItem("auth_was_authenticated") === "1";
    if (!wasAuthenticated) {
      setIsInitializing(false);
      return;
    }
    refreshSession().finally(() => setIsInitializing(false));
  }, [refreshSession]);

  const apiFetch = useCallback(
    async <T,>(path: string, init: RequestJsonInit = {}) => {
      const requestInit: RequestJsonInit = { ...init, notifySuccess: init.notifySuccess ?? false };
      try {
        return await requestJson<T>(path, requestInit, tokenRef.current);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          // If there is no in-memory token, avoid triggering refresh on every 401 call.
          if (!tokenRef.current) {
            throw error;
          }
          const token = await refreshSession();
          if (token) {
            return requestJson<T>(path, requestInit, token);
          }
        }
        throw error;
      }
    },
    [refreshSession],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await requestJson<ApiEnvelope<LoginResponse>>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setSession(response.data.user, response.data.accessToken);
    },
    [setSession],
  );

  const register = useCallback(async (input: { name: string; email: string; password: string; role?: string }) => {
    const response = await requestJson<ApiEnvelope<{ user: User }>>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name: input.name, email: input.email, password: input.password, role: input.role || 'USER' }),
      notifySuccess: false,
    });
    return response.message ?? "Đăng ký thành công. Vui lòng xác minh email trước khi đăng nhập.";
  }, []);

  const logout = useCallback(async () => {
    try {
      await requestJson<ApiEnvelope<null>>(
        "/auth/logout",
        { method: "POST" },
        tokenRef.current,
      );
    } catch (error) {
      // Logout should always succeed on the client side even if backend rejects
      // repeated requests (429) or the session is already invalid.
      if (error instanceof ApiError && (error.status === 401 || error.status === 403 || error.status === 429)) {
        return;
      }
    } finally {
      setSession(null, null);
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem("auth_was_authenticated");
      }
    }
  }, [setSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      isAuthenticated: Boolean(user && accessToken),
      isInitializing,
      login,
      register,
      logout,
      refreshSession,
      apiFetch,
    }),
    [accessToken, apiFetch, isInitializing, login, logout, refreshSession, register, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
