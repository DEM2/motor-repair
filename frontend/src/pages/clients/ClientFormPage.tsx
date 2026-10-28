/**
 * Formulario de cliente: sirve para crear (/clients/new) y para editar (/clients/:id/edit).
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { clientsApi } from '../../api/endpoints';
import { useToast } from '../../components/Toast';
import { ErrorAlert, Field, LoadingState, PageHeader } from '../../components/ui';
import { IDENTIFICATION_TYPE_LABELS } from '../../utils/labels';

const clientSchema = z.object({
  name: z.string().trim().min(2, 'Mínimo 2 caracteres').max(150, 'Máximo 150 caracteres'),
  identification_type: z.enum(['NIT', 'CC', 'CE', 'PASSPORT'], { errorMap: () => ({ message: 'Seleccione un tipo' }) }),
  identification_number: z
    .string()
    .trim()
    .min(3, 'Mínimo 3 caracteres')
    .max(30, 'Máximo 30 caracteres')
    .regex(/^[A-Za-z0-9.-]+$/, 'Solo letras, números, puntos y guiones'),
  email: z.string().trim().email('Correo electrónico inválido'),
  is_active: z.boolean(),
});
type ClientForm = z.infer<typeof clientSchema>;

export function ClientFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();

  const existing = useQuery({
    queryKey: ['clients', 'detail', id],
    queryFn: () => clientsApi.get(id!),
    enabled: isEdit,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ClientForm>({
    resolver: zodResolver(clientSchema),
    defaultValues: { name: '', identification_type: 'NIT', identification_number: '', email: '', is_active: true },
  });

  useEffect(() => {
    if (existing.data) {
      const { name, identification_type, identification_number, email, is_active } = existing.data;
      reset({ name, identification_type, identification_number, email, is_active });
    }
  }, [existing.data, reset]);

  const mutation = useMutation({
    mutationFn: (values: ClientForm) => (isEdit ? clientsApi.update(id!, values) : clientsApi.create(values)),
    onSuccess: (client) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success(isEdit ? 'Cliente actualizado correctamente' : 'Cliente registrado correctamente');
      navigate(`/clients/${client.id}`);
    },
  });

  if (isEdit && existing.isLoading) return <LoadingState />;
  if (isEdit && existing.error) return <ErrorAlert error={existing.error} />;

  return (
    <>
      <PageHeader title={isEdit ? 'Editar cliente' : 'Nuevo cliente'} />
      <form className="card form" onSubmit={handleSubmit((v) => mutation.mutate(v))} noValidate>
        <ErrorAlert error={mutation.error} />

        <Field label="Nombre o razón social" htmlFor="name" error={errors.name?.message} required>
          <input id="name" {...register('name')} />
        </Field>

        <div className="form__row">
          <Field label="Tipo de identificación" htmlFor="identification_type" error={errors.identification_type?.message} required>
            <select id="identification_type" {...register('identification_type')}>
              {Object.entries(IDENTIFICATION_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Número de identificación"
            htmlFor="identification_number"
            error={errors.identification_number?.message}
            hint="Debe ser único en el sistema"
            required
          >
            <input id="identification_number" {...register('identification_number')} />
          </Field>
        </div>

        <Field label="Correo electrónico" htmlFor="email" error={errors.email?.message} required>
          <input id="email" type="email" {...register('email')} />
        </Field>

        <label className="checkbox">
          <input type="checkbox" {...register('is_active')} /> Cliente activo
        </label>

        <div className="form__actions">
          <Link to={isEdit ? `/clients/${id}` : '/clients'} className="btn btn--ghost">
            Cancelar
          </Link>
          <button type="submit" className="btn btn--primary" disabled={mutation.isPending}>
            {mutation.isPending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </>
  );
}
