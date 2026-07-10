import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

const STORAGE_KEY = 'rootsight_auth_state';

interface AuthState {
  isAuthenticated: boolean;
  isDemo: boolean;
  email: string | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string) => Promise<void>;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => readStoredState());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage unavailable (private browsing, etc.) — auth simply won't persist across refresh.
    }
  }, [state]);

  const login = async (email: string) => setState({ isAuthenticated: true, isDemo: false, email });
  const loginDemo = async () => setState({ isAuthenticated: true, isDemo: true, email: 'demo@rootsight.ai' });
  const logout = async () => setState(defaultState);

  return (
    <AuthContext.Provider value={{ ...state, login, loginDemo, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}