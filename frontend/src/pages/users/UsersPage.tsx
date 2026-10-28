/**
 * Administración de usuarios (solo rol ADMIN): listado, registro, cambio de rol y
 * activación/desactivación. Consume auth-service.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { usersApi, type CreateUserInput } from '../../api/endpoints';
import type { Role, User } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../components/Toast';
import { ActiveBadge, ErrorAlert, Field, LoadingState, PageHeader } from '../../components/ui';
import { formatDateTime } from '../../utils/format';
import { ROLE_LABELS } from '../../utils/labels';

const userSchema = z.object({
  fullName: z.string().trim().min(3, 'Mínimo 3 caracteres').max(120),
  email: z.string().trim().email('Correo electrónico inválido'),
  password: z
    .string()
    .min(8, 'Mínimo 8 caracteres')
    .max(72, 'Máximo 72 caracteres')
    .regex(/[a-z]/, 'Debe incluir una minúscula')
    .regex(/[A-Z]/, 'Debe incluir una mayúscula')
    .regex(/\d/, 'Debe incluir un número'),
  role: z.enum(['ADMIN', 'OPERATOR']),
});

export function UsersPage() {
  const { user: me } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const users = useQuery({ queryKey: ['users'], queryFn: usersApi.list });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateUserInput>({
    resolver: zodResolver(userSchema),
    defaultValues: { fullName: '', email: '', password: '', role: 'OPERATOR' },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['users'] });

  const create = useMutation({
    mutationFn: usersApi.create,
    onSuccess: (user) => {
      refresh();
      reset();
      toast.success(`Usuario ${user.email} registrado`);
    },
  });

  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) => usersApi.update(id, { role }),
    onSuccess: (user) => {
      refresh();
      toast.success(`Rol de ${user.email} actualizado a ${ROLE_LABELS[user.role]}`);
    },
    onError: (error) => toast.error(error.message),
  });

  const toggleActive = useMutation({
    mutationFn: (user: User) => usersApi.setActive(user.id, !user.isActive),
    onSuccess: (user) => {
      refresh();
      toast.success(`Usuario ${user.email} ${user.isActive ? 'activado' : 'desactivado'}`);
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <>
      <PageHeader title="Usuarios" subtitle="Administración de cuentas y roles de acceso" />

      <div className="grid-2 grid-2--wide-left">
        <section className="card">
          <h2 className="card__title">Usuarios registrados</h2>
          {users.isLoading && <LoadingState />}
          <ErrorAlert error={users.error} />
          {users.data && (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Rol</th>
                    <th>Último acceso</th>
                    <th>Estado</th>
                    <th aria-label="Acciones" />
                  </tr>
                </thead>
                <tbody>
                  {users.data.map((u) => {
                    const isMe = u.id === me?.id;
                    return (
                      <tr key={u.id}>
                        <td>
                          <strong>{u.fullName}</strong>
                          {isMe && <span className="muted small"> (usted)</span>}
                          <div className="muted small">{u.email}</div>
                        </td>
                        <td>
                          <select
                            value={u.role}
                            disabled={isMe || changeRole.isPending}
                            onChange={(e) => changeRole.mutate({ id: u.id, role: e.target.value as Role })}
                            aria-label={`Rol de ${u.email}`}
                          >
                            <option value="OPERATOR">{ROLE_LABELS.OPERATOR}</option>
                            <option value="ADMIN">{ROLE_LABELS.ADMIN}</option>
                          </select>
                        </td>
                        <td>{formatDateTime(u.lastLoginAt)}</td>
                        <td>
                          <ActiveBadge active={u.isActive} />
                        </td>
                        <td>
                          {!isMe && (
                            <button
                              type="button"
                              className={`btn btn--small ${u.isActive ? 'btn--danger' : 'btn--secondary'}`}
                              disabled={toggleActive.isPending}
                              onClick={() => toggleActive.mutate(u)}
                            >
                              {u.isActive ? 'Desactivar' : 'Activar'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card">
          <h2 className="card__title">Registrar usuario</h2>
          <form className="form" onSubmit={handleSubmit((v) => create.mutate(v))} noValidate>
            <ErrorAlert error={create.error} title="No se pudo registrar el usuario" />
            <Field label="Nombre completo" htmlFor="fullName" error={errors.fullName?.message} required>
              <input id="fullName" {...register('fullName')} />
            </Field>
            <Field label="Correo electrónico" htmlFor="new-email" error={errors.email?.message} required>
              <input id="new-email" type="email" autoComplete="off" {...register('email')} />
            </Field>
            <Field
              label="Contraseña inicial"
              htmlFor="new-password"
              error={errors.password?.message}
              hint="Mínimo 8 caracteres con mayúscula, minúscula y número"
              required
            >
              <input id="new-password" type="password" autoComplete="new-password" {...register('password')} />
            </Field>
            <Field label="Rol" htmlFor="role" required>
              <select id="role" {...register('role')}>
                <option value="OPERATOR">{ROLE_LABELS.OPERATOR}</option>
                <option value="ADMIN">{ROLE_LABELS.ADMIN}</option>
              </select>
            </Field>
            <button type="submit" className="btn btn--primary" disabled={create.isPending}>
              {create.isPending ? 'Registrando…' : 'Registrar usuario'}
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
