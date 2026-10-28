/**
 * Cliente HTTP mínimo basado en fetch.
 *
 * - Adjunta automáticamente `Authorization: Bearer <token>` a las peticiones protegidas.
 * - Convierte las respuestas de error de AMBAS APIs (mismo formato
 *   `{ error: { code, message, details } }`) en un `ApiError` tipado.
 * - Si una API responde 401 (token expirado o inválido), notifica a la sesión para
 *   cerrarla y redirigir al login.
 */
import { config } from '../config';

export interface FieldError {
  field: string;
  message: string;
  location?: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Errores por campo (validación), si la API los envió. */
  get fieldErrors(): FieldError[] {
    return Array.isArray(this.details) ? (this.details as FieldError[]) : [];
  }
}

type QueryValue = string | number | boolean | null | undefined;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
  query?: Record<string, QueryValue>;
  /** false para endpoints públicos (por ejemplo, el login). */
  auth?: boolean;
}

let tokenProvider: () => string | null = () => null;
let unauthorizedHandler: () => void = () => {};

/** La sesión registra aquí cómo obtener el token y qué hacer ante un 401. */
export function configureHttp(options: { getToken: () => string | null; onUnauthorized: () => void }): void {
  tokenProvider = options.getToken;
  unauthorizedHandler = options.onUnauthorized;
}

export function buildUrl(baseUrl: string, path: string, query?: Record<string, QueryValue>): string {
  const url = new URL(path, baseUrl);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function request<T>(baseUrl: string, path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, auth = true } = options;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const token = auth ? tokenProvider() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(buildUrl(baseUrl, path, query), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'No se pudo conectar con el servidor. Verifique que los servicios estén en ejecución.');
  }

  const data = response.status === 204 ? null : await response.json().catch(() => null);

  if (!response.ok) {
    const error = (data as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
    if (response.status === 401 && auth) {
      unauthorizedHandler();
    }
    throw new ApiError(
      response.status,
      error?.code ?? 'HTTP_ERROR',
      error?.message ?? `Error inesperado (${response.status})`,
      error?.details,
    );
  }
  return data as T;
}

/** Peticiones a auth-service (Express). */
export const authHttp = <T>(path: string, options?: RequestOptions) => request<T>(config.authApiUrl, path, options);

/** Peticiones a business-service (FastAPI). */
export const businessHttp = <T>(path: string, options?: RequestOptions) =>
  request<T>(config.businessApiUrl, path, options);
