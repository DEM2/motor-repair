/**
 * URLs de las APIs. Vite reemplaza `import.meta.env.VITE_*` en tiempo de compilación.
 * Son públicas (el navegador las necesita), por eso nunca deben contener secretos.
 */
export const config = {
  authApiUrl: import.meta.env.VITE_AUTH_API_URL ?? 'http://localhost:4000',
  businessApiUrl: import.meta.env.VITE_BUSINESS_API_URL ?? 'http://localhost:8000',
};
