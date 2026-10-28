/**
 * Componentes de interfaz reutilizables: carga, errores, estados vacíos, encabezados,
 * paginación y campos de formulario. Dan consistencia visual a todas las pantallas.
 */
import type { ReactNode } from 'react';
import { ApiError } from '../api/http';

export function Spinner({ label = 'Cargando…' }: { label?: string }) {
  return (
    <span className="spinner" role="status" aria-live="polite">
      <span className="spinner__circle" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function LoadingState({ label = 'Cargando información…' }: { label?: string }) {
  return (
    <div className="state">
      <Spinner label={label} />
      <p>{label}</p>
    </div>
  );
}

/** Muestra el mensaje de un error de API y, si existen, los errores por campo. */
export function ErrorAlert({ error, title = 'No se pudo completar la operación' }: { error: unknown; title?: string }) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : 'Ocurrió un error inesperado';
  const fieldErrors = error instanceof ApiError ? error.fieldErrors : [];

  return (
    <div className="alert alert--error" role="alert">
      <strong>{title}</strong>
      <p>{message}</p>
      {fieldErrors.length > 0 && (
        <ul>
          {fieldErrors.map((e, i) => (
            <li key={i}>
              {e.field ? <code>{e.field}</code> : null} {e.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="state state--empty">
      <p className="state__title">{title}</p>
      {children}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  );
}

export function Pagination({
  page,
  pages,
  total,
  onChange,
}: {
  page: number;
  pages: number;
  total: number;
  onChange: (page: number) => void;
}) {
  if (pages <= 1) return <p className="pagination__info">{total} registro(s)</p>;
  return (
    <nav className="pagination" aria-label="Paginación">
      <span className="pagination__info">
        {total} registro(s) · página {page} de {pages}
      </span>
      <button type="button" className="btn btn--ghost" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        ← Anterior
      </button>
      <button type="button" className="btn btn--ghost" disabled={page >= pages} onClick={() => onChange(page + 1)}>
        Siguiente →
      </button>
    </nav>
  );
}

/** Envoltorio de un campo de formulario con etiqueta, ayuda y mensaje de error. */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`field${error ? ' field--invalid' : ''}`}>
      <label htmlFor={htmlFor}>
        {label}
        {required && <span className="field__required" aria-hidden="true"> *</span>}
      </label>
      {children}
      {hint && !error && <small className="field__hint">{hint}</small>}
      {error && (
        <small className="field__error" role="alert">
          {error}
        </small>
      )}
    </div>
  );
}

export function ActiveBadge({ active }: { active: boolean }) {
  return <span className={`badge ${active ? 'badge--active' : 'badge--inactive'}`}>{active ? 'Activo' : 'Inactivo'}</span>;
}

/** Par etiqueta/valor para vistas de detalle. */
export function DetailItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="detail-item">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
