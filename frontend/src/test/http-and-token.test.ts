import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, buildUrl, businessHttp, configureHttp } from '../api/http';
import { decodeToken, msUntilExpiry } from '../auth/token';
import { fakeJwt, jsonResponse } from './utils';

afterEach(() => vi.restoreAllMocks());

describe('cliente HTTP', () => {
  it('construye la URL omitiendo filtros vacíos', () => {
    expect(buildUrl('http://api', '/api/clients', { q: '', page: 2, is_active: false, x: undefined })).toBe(
      'http://api/api/clients?page=2&is_active=false',
    );
  });

  it('adjunta el token Bearer en las peticiones a business-service', async () => {
    configureHttp({ getToken: () => 'abc.def.ghi', onUnauthorized: () => {} });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ items: [] }));

    await businessHttp('/api/clients');

    const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer abc.def.ghi');
  });

  it('convierte el formato de error de las APIs en ApiError con errores por campo', async () => {
    configureHttp({ getToken: () => 't', onUnauthorized: () => {} });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(
        { error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: [{ field: 'email', message: 'mal' }] } },
        422,
      ),
    );

    const error = (await businessHttp('/api/clients').catch((e) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(422);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.fieldErrors).toEqual([{ field: 'email', message: 'mal' }]);
  });

  it('notifica a la sesión cuando una API responde 401', async () => {
    const onUnauthorized = vi.fn();
    configureHttp({ getToken: () => 'expirado', onUnauthorized });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ error: { code: 'UNAUTHORIZED', message: 'El token ha expirado' } }, 401),
    );

    await expect(businessHttp('/api/clients')).rejects.toThrow('El token ha expirado');
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it('informa claramente un error de red', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(businessHttp('/api/clients')).rejects.toMatchObject({ code: 'NETWORK_ERROR', status: 0 });
  });
});

describe('lectura del token', () => {
  it('decodifica el payload y calcula el tiempo restante', () => {
    const now = Date.now();
    const token = fakeJwt({ sub: 'u1', name: 'José Peña', exp: Math.floor(now / 1000) + 60 });
    expect(decodeToken(token)?.name).toBe('José Peña');
    expect(msUntilExpiry(token, now)).toBeGreaterThan(55_000);
  });

  it('considera expirado un token vencido o ilegible', () => {
    expect(msUntilExpiry(fakeJwt({ exp: 1 }))).toBe(0);
    expect(msUntilExpiry('no-es-un-jwt')).toBe(0);
  });
});
