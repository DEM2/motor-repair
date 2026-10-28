/**
 * Gestión de la sesión del usuario.
 *
 * Decisiones:
 * - El token se guarda en `sessionStorage` (no en localStorage): se borra al cerrar la
 *   pestaña y no se comparte entre pestañas, lo que reduce la ventana de exposición.
 * - La sesión se cierra automáticamente cuando el token expira, o cuando cualquiera de
 *   las APIs responde 401.
 * - El frontend se autentica SOLO contra auth-service; luego usa el mismo token para
 *   llamar a business-service.
 */
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { authApi } from '../api/endpoints';
import { configureHttp } from '../api/http';
import type { User } from '../api/types';
import { msUntilExpiry } from './token';

const STORAGE_KEY = 'motor-repair.session';

interface Session {
  token: string;
  user: User;
}

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  /** Motivo del último cierre de sesión automático (se muestra en el login). */
  logoutReason: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: (reason?: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as Session;
    return msUntilExpiry(session.token) > 0 ? session : null;
  } catch {
    return null;
  }
}

function saveSession(session: Session | null): void {
  try {
    if (session) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // El almacenamiento puede no estar disponible (modo privado); la sesión sigue en memoria.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(loadSession);
  const [logoutReason, setLogoutReason] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // La referencia permite que el cliente HTTP lea siempre el token vigente, incluso en
  // peticiones disparadas en el mismo render en que cambia la sesión.
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const logout = useCallback(
    (reason?: string) => {
      saveSession(null);
      setSession(null);
      setLogoutReason(reason ?? null);
      queryClient.clear(); // descarta datos en caché del usuario anterior
    },
    [queryClient],
  );

  const login = useCallback(async (email: string, password: string) => {
    const result = await authApi.login(email, password);
    const newSession = { token: result.accessToken, user: result.user };
    saveSession(newSession);
    setLogoutReason(null);
    setSession(newSession);
  }, []);

  // Conecta el cliente HTTP con la sesión (se hace durante el render, antes que los efectos hijos).
  configureHttp({
    getToken: () => sessionRef.current?.token ?? null,
    onUnauthorized: () => logout('Su sesión expiró o no es válida. Inicie sesión nuevamente.'),
  });

  // Cierre automático justo cuando el token expira.
  useEffect(() => {
    if (!session) return;
    const timer = window.setTimeout(
      () => logout('Su sesión expiró. Inicie sesión nuevamente.'),
      msUntilExpiry(session.token),
    );
    return () => window.clearTimeout(timer);
  }, [session, logout]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      isAuthenticated: session !== null,
      isAdmin: session?.user.role === 'ADMIN',
      logoutReason,
      login,
      logout,
    }),
    [session, logoutReason, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  }
  return context;
}
