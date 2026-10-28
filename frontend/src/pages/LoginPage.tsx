/**
 * Pantalla de inicio de sesión. Se autentica exclusivamente contra auth-service.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '../auth/AuthContext';
import { ErrorAlert, Field, Spinner } from '../components/ui';

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Ingrese su correo').email('Correo electrónico inválido'),
  password: z.string().min(1, 'Ingrese su contraseña'),
});
type LoginForm = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { login, isAuthenticated, logoutReason } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<unknown>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/';
  if (isAuthenticated) return <Navigate to={redirectTo} replace />;

  const onSubmit = async (values: LoginForm) => {
    setError(null);
    try {
      await login(values.email, values.password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err);
    }
  };

  return (
    <div className="login">
      <section className="login__panel">
        <div className="login__brand">
          <img src="/favicon.svg" alt="" width={48} height={48} />
          <div>
            <h1>Taller de Motores</h1>
            <p>Gestión de reparaciones de maquinaria de minería pesada</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="form">
          <h2>Iniciar sesión</h2>
          {logoutReason && !error && <div className="alert alert--info">{logoutReason}</div>}
          <ErrorAlert error={error} title="No fue posible iniciar sesión" />

          <Field label="Correo electrónico" htmlFor="email" error={errors.email?.message} required>
            <input id="email" type="email" autoComplete="username" autoFocus {...register('email')} />
          </Field>

          <Field label="Contraseña" htmlFor="password" error={errors.password?.message} required>
            <input id="password" type="password" autoComplete="current-password" {...register('password')} />
          </Field>

          <button type="submit" className="btn btn--primary btn--block" disabled={isSubmitting}>
            {isSubmitting ? <Spinner label="Ingresando…" /> : null}
            {isSubmitting ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </section>
    </div>
  );
}
