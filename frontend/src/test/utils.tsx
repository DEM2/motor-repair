/**
 * Renderiza un componente con todos los proveedores que usa la aplicación real
 * (React Query, router, notificaciones y sesión).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext';
import { ToastProvider } from '../components/Toast';

export function renderWithProviders(ui: ReactElement, { route = '/', path = '/' } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ToastProvider>
          <AuthProvider>
            <Routes>
              <Route path={path} element={ui} />
              <Route path="*" element={<div>Otra página</div>} />
            </Routes>
          </AuthProvider>
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Crea un JWT de prueba (sin firma válida: el frontend solo lee la expiración). */
/**
 * Crea un JWT de prueba (sin firma válida: el frontend solo lee la expiración).
 * El JSON se codifica en UTF-8 antes de pasarlo a base64url, igual que un JWT real,
 * para que los caracteres con tilde (José Peña) se decodifiquen correctamente.
 */
export function fakeJwt(payload: Record<string, unknown>): string {
  const encode = (obj: unknown) => {
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join('');
    return btoa(binary).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  };
  return `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode(payload)}.firma`;
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
