import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import {
  AUTH_TOKEN_KEY,
  signupRequest,
  loginRequest,
  loginDemoRequest,
  logoutRequest,
  getCurrentUser,
} from '../api/client';

const STORAGE_KEY = 'rootsight_auth_state';

interface AuthState {
  isAuthenticated: boolean;
  isDemo: boolean;
  email: string | null;
}

interface AuthContextValue extends AuthState {
  /** True until the cached session (if any) has been re-validated against
   *  the backend once on load. App.tsx holds a neutral splash on this rather
   *  than flashing Login before the check completes. */
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  loginDemo: () => Promise<void>;
  logout: () => Promise<void>;
}

const defaultState: AuthState = { isAuthenticated: false, isDemo: false, email: null };

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readStoredState(): AuthState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw);
    return {
      isAuthenticated: !!parsed.isAuthenticated,
      isDemo: !!parsed.isDemo,
      email: parsed.email ?? null,
    };
  } catch {
    return defaultState;
  }
}

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

function storeToken(token: string) {
  try {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } catch {
    // Storage unavailable (private browsing, etc.) — session won't survive refresh.
  }
}

function clearToken() {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    // Nothing further to do — there was never a persisted token to worry about.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => readStoredState());
  const [loading, setLoading] = useState(true);

  // On mount, re-validate any cached session against the backend rather than
  // trusting the localStorage flags on faith — a token can expire (30-day
  // TTL) or be invalidated by a server restart between visits.
  useEffect(() => {
    let cancelled = false;
    const token = readStoredToken();

    if (!token) {
      clearToken();
      setState(defaultState);
      setLoading(false);
      return;
    }

    getCurrentUser()
      .then((res) => {
        if (cancelled) return;
        setState({ isAuthenticated: true, isDemo: !!res.user.isDemo, email: res.user.email });
      })
      .catch(() => {
        // Token expired/invalid, or server unreachable — drop the stale
        // session rather than showing "authenticated" state the backend
        // won't actually honor on the next real request.
        if (cancelled) return;
        clearToken();
        setState(defaultState);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage unavailable (private browsing, etc.) — auth simply won't persist across refresh.
    }
  }, [state]);

  const login = async (email: string, password: string) => {
    const res = await loginRequest(email, password);
    storeToken(res.token);
    setState({ isAuthenticated: true, isDemo: !!res.user.isDemo, email: res.user.email });
  };

  const signup = async (name: string, email: string, password: string) => {
    const res = await signupRequest(name, email, password);
    storeToken(res.token);
    setState({ isAuthenticated: true, isDemo: !!res.user.isDemo, email: res.user.email });
  };

  const loginDemo = async () => {
    const res = await loginDemoRequest();
    storeToken(res.token);
    setState({ isAuthenticated: true, isDemo: !!res.user.isDemo, email: res.user.email });
  };

  const logout = async () => {
    try {
      await logoutRequest();
    } catch {
      // Session may already be expired server-side — clear local state regardless.
    }
    clearToken();
    setState(defaultState);
  };

  return (
    <AuthContext.Provider value={{ ...state, loading, login, signup, loginDemo, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}