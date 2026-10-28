import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoginPage } from '../pages/LoginPage';
import { fakeJwt, jsonResponse, renderWithProviders } from './utils';

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe('LoginPage', () => {
  it('valida los campos antes de llamar a la API', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    renderWithProviders(<LoginPage />, { route: '/login', path: '/login' });

    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByText('Ingrese su correo')).toBeInTheDocument();
    expect(screen.getByText('Ingrese su contraseña')).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('muestra el mensaje de error de la API cuando las credenciales son incorrectas', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ error: { code: 'UNAUTHORIZED', message: 'Correo o contraseña incorrectos' } }, 401),
    );
    renderWithProviders(<LoginPage />, { route: '/login', path: '/login' });

    await userEvent.type(screen.getByLabelText(/correo electrónico/i), 'ana@taller.local');
    await userEvent.type(screen.getByLabelText(/contraseña/i), 'Incorrecta1');
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByText('Correo o contraseña incorrectos')).toBeInTheDocument();
  });

  it('inicia sesión contra auth-service, guarda la sesión y redirige', async () => {
    const token = fakeJwt({ sub: 'u1', role: 'ADMIN', exp: Math.floor(Date.now() / 1000) + 3600 });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        accessToken: token,
        tokenType: 'Bearer',
        expiresIn: 3600,
        user: { id: 'u1', email: 'ana@taller.local', fullName: 'Ana', role: 'ADMIN', isActive: true },
      }),
    );
    renderWithProviders(<LoginPage />, { route: '/login', path: '/login' });

    await userEvent.type(screen.getByLabelText(/correo electrónico/i), 'ana@taller.local');
    await userEvent.type(screen.getByLabelText(/contraseña/i), 'Secreta123');
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));

    await waitFor(() => expect(screen.getByText('Otra página')).toBeInTheDocument());
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toBe('http://localhost:4000/api/auth/login');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(sessionStorage.getItem('motor-repair.session')!).token).toBe(token);
  });
});
