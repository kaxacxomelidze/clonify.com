import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  fetchMe,
  getAuthToken,
  loginRequest,
  logoutRequest,
  registerRequest,
  setAuthToken,
  ensureApiAwake,
  startApiKeepWarm,
  type AuthUser,
  type UsageSummary,
} from "@/lib/api";

type AuthContextValue = {
  user: AuthUser | null;
  usage: UsageSummary | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  acceptToken: (token: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const applySession = useCallback((token: string, nextUser: AuthUser, nextUsage?: UsageSummary) => {
    setAuthToken(token);
    setUser(nextUser);
    setUsage(nextUsage || null);
  }, []);

  const refresh = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setUser(null);
      setUsage(null);
      return;
    }
    const data = await fetchMe();
    setUser(data.user);
    setUsage(data.usage || null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const stopWarm = startApiKeepWarm();
    (async () => {
      try {
        await ensureApiAwake({ attempts: 4, timeoutMs: 10_000 }).catch(() => {});
        if (!getAuthToken()) return;
        await refresh();
      } catch {
        setAuthToken(null);
        if (!cancelled) {
          setUser(null);
          setUsage(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      stopWarm();
    };
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await loginRequest(email, password, true);
      applySession(data.token, data.user, data.usage);
    },
    [applySession],
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const data = await registerRequest(name, email, password);
      applySession(data.token, data.user, data.usage);
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    await logoutRequest();
    setUser(null);
    setUsage(null);
  }, []);

  const acceptToken = useCallback(
    async (token: string) => {
      setAuthToken(token);
      const data = await fetchMe();
      applySession(token, data.user, data.usage);
    },
    [applySession],
  );

  const value = useMemo(
    () => ({
      user,
      usage,
      loading,
      isAuthenticated: !!user,
      login,
      register,
      logout,
      refresh,
      acceptToken,
    }),
    [user, usage, loading, login, register, logout, refresh, acceptToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
