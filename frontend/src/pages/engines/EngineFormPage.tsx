/**
 * Formulario de motor: crear (/engines/new) o editar (/engines/:id/edit).
 * Acepta ?clientId=... para preseleccionar el propietario desde el detalle del cliente.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { clientsApi, enginesApi } from '../../api/endpoints';
import { useToast } from '../../components/Toast';
import { ErrorAlert, Field, LoadingState, PageHeader } from '../../components/ui';

const text = (max: number) => z.string().trim().min(1, 'Campo obligatorio').max(max, `Máximo ${max} caracteres`);

const engineSchema = z.object({
  serial_number: z.string().trim().min(2, 'Mínimo 2 caracteres').max(60, 'Máximo 60 caracteres'),
  manufacturer: text(100),
  model: text(100),
  engine_type: text(100),
  power: text(60),
  client_id: z.string().uuid('Seleccione el cliente propietario'),
  is_active: z.boolean(),
});
type EngineForm = z.infer<typeof engineSchema>;

export function EngineFormPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();

  const existing = useQuery({ queryKey: ['engines', 'detail', id], queryFn: () => enginesApi.get(id!), enabled: isEdit });
  // Solo se pueden asignar motores a clientes activos (regla del backend).
  const clients = useQuery({
    queryKey: ['clients', 'options', 'active'],
    queryFn: () => clientsApi.list({ is_active: true, size: 100 }),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EngineForm>({
    resolver: zodResolver(engineSchema),
    defaultValues: {
      serial_number: '',
      manufacturer: '',
      model: '',
      engine_type: '',
      power: '',
      client_id: searchParams.get('clientId') ?? '',
      is_active: true,
    },
  });

  useEffect(() => {
    if (existing.data) {
      const { serial_number, manufacturer, model, engine_type, power, client_id, is_active } = existing.data;
      reset({ serial_number, manufacturer, model, engine_type, power, client_id, is_active });
    }
  }, [existing.data, reset]);

  const mutation = useMutation({
    mutationFn: (values: EngineForm) => (isEdit ? enginesApi.update(id!, values) : enginesApi.create(values)),
    onSuccess: (engine) => {
      queryClient.invalidateQueries({ queryKey: ['engines'] });
      toast.success(isEdit ? 'Motor actualizado correctamente' : 'Motor registrado correctamente');
      navigate(`/engines/${engine.id}`);
    },
  });

  // Se espera a tener las opciones del <select> antes de pintar el formulario, para que
  // el valor inicial (cliente preseleccionado o el actual) se aplique correctamente.
  if ((isEdit && existing.isLoading) || clients.isLoading) return <LoadingState />;
  if (isEdit && existing.error) return <ErrorAlert error={existing.error} />;
  if (clients.error) return <ErrorAlert error={clients.error} title="No se pudieron cargar los clientes" />;

  // Si el propietario actual está inactivo, se muestra igualmente para no perder el dato.
  const clientOptions = clients.data?.items ?? [];
  const currentOwner = existing.data?.client;
  const ownerMissing = currentOwner && !clientOptions.some((c) => c.id === currentOwner.id);

  return (
    <>
      <PageHeader title={isEdit ? 'Editar motor' : 'Nuevo motor'} />
      <form className="card form" onSubmit={handleSubmit((v) => mutation.mutate(v))} noValidate>
        <ErrorAlert error={mutation.error} />

        <div className="form__row">
          <Field
            label="Código interno / número de serie"
            htmlFor="serial_number"
            error={errors.serial_number?.message}
            hint="Único en el sistema"
            required
          >
            <input id="serial_number" {...register('serial_number')} />
          </Field>
          <Field label="Cliente propietario" htmlFor="client_id" error={errors.client_id?.message} required>
            <select id="client_id" {...register('client_id')}>
              <option value="">Seleccione…</option>
              {currentOwner && ownerMissing && <option value={currentOwner.id}>{currentOwner.name} (inactivo)</option>}
              {clientOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.identification_number}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="form__row">
          <Field label="Fabricante" htmlFor="manufacturer" error={errors.manufacturer?.message} required>
            <input id="manufacturer" placeholder="Ej.: Caterpillar" {...register('manufacturer')} />
          </Field>
          <Field label="Modelo" htmlFor="model" error={errors.model?.message} required>
            <input id="model" placeholder="Ej.: 3516B" {...register('model')} />
          </Field>
        </div>

        <div className="form__row">
          <Field label="Tipo de motor" htmlFor="engine_type" error={errors.engine_type?.message} required>
            <input id="engine_type" placeholder="Ej.: Diésel V16" {...register('engine_type')} />
          </Field>
          <Field label="Potencia o capacidad" htmlFor="power" error={errors.power?.message} required>
            <input id="power" placeholder="Ej.: 2000 HP" {...register('power')} />
          </Field>
        </div>

        <label className="checkbox">
          <input type="checkbox" {...register('is_active')} /> Motor activo
        </label>

        <div className="form__actions">
          <Link to={isEdit ? `/engines/${id}` : '/engines'} className="btn btn--ghost">
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
