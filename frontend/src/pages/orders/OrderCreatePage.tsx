/**
 * Registro de una orden de reparación. El cliente propietario se deduce del motor
 * (lo hace el backend); aquí solo se muestra como referencia.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { enginesApi, repairOrdersApi, type RepairOrderInput } from '../../api/endpoints';
import { useToast } from '../../components/Toast';
import { EmptyState, ErrorAlert, Field, LoadingState, PageHeader } from '../../components/ui';
import { todayIso } from '../../utils/format';

const optionalText = z
  .string()
  .trim()
  .max(5000, 'Máximo 5000 caracteres')
  .refine((v) => v === '' || v.length >= 3, 'Mínimo 3 caracteres')
  .optional();

const orderSchema = z
  .object({
    engine_id: z.string().uuid('Seleccione el motor'),
    reception_date: z.string().min(1, 'Seleccione la fecha de recepción'),
    estimated_delivery_date: z.string().min(1, 'Seleccione la fecha estimada de entrega'),
    reported_problem: z.string().trim().min(3, 'Describa el problema (mínimo 3 caracteres)').max(5000),
    technician: z.string().trim().min(3, 'Indique el técnico responsable').max(120),
    diagnosis: optionalText,
    work_performed: optionalText,
    observations: optionalText,
  })
  .refine((v) => v.reception_date <= todayIso(), {
    path: ['reception_date'],
    message: 'La fecha de recepción no puede estar en el futuro',
  })
  .refine((v) => v.estimated_delivery_date >= v.reception_date, {
    path: ['estimated_delivery_date'],
    message: 'Debe ser igual o posterior a la fecha de recepción',
  });
type OrderForm = z.infer<typeof orderSchema>;

/** Los campos opcionales vacíos no se envían (la API los guarda como nulos). */
function toPayload(values: OrderForm): RepairOrderInput {
  const clean = (v?: string) => (v && v.trim() ? v.trim() : undefined);
  return {
    ...values,
    diagnosis: clean(values.diagnosis),
    work_performed: clean(values.work_performed),
    observations: clean(values.observations),
  };
}

export function OrderCreatePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();

  // Solo motores activos pueden recibir órdenes (regla del backend).
  const engines = useQuery({
    queryKey: ['engines', 'options', 'active'],
    queryFn: () => enginesApi.list({ is_active: true, size: 100 }),
  });

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<OrderForm>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      engine_id: searchParams.get('engineId') ?? '',
      reception_date: todayIso(),
      estimated_delivery_date: '',
      reported_problem: '',
      technician: '',
      diagnosis: '',
      work_performed: '',
      observations: '',
    },
  });

  const mutation = useMutation({
    mutationFn: (values: OrderForm) => repairOrdersApi.create(toPayload(values)),
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ['repair-orders'] });
      toast.success(`Orden ${order.order_number} creada correctamente`);
      navigate(`/orders/${order.id}`);
    },
  });

  if (engines.isLoading) return <LoadingState />;
  if (engines.error) return <ErrorAlert error={engines.error} title="No se pudieron cargar los motores" />;

  const engineOptions = engines.data?.items ?? [];
  const selectedEngine = engineOptions.find((e) => e.id === watch('engine_id'));

  return (
    <>
      <PageHeader title="Nueva orden de reparación" />

      {engineOptions.length === 0 ? (
        <EmptyState title="No hay motores activos registrados">
          <Link to="/engines/new" className="btn btn--primary">
            Registrar un motor
          </Link>
        </EmptyState>
      ) : (
        <form className="card form" onSubmit={handleSubmit((v) => mutation.mutate(v))} noValidate>
          <ErrorAlert error={mutation.error} title="No se pudo crear la orden" />

          <Field label="Motor" htmlFor="engine_id" error={errors.engine_id?.message} required>
            <select id="engine_id" {...register('engine_id')}>
              <option value="">Seleccione…</option>
              {engineOptions.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.serial_number} · {e.manufacturer} {e.model} — {e.client.name}
                </option>
              ))}
            </select>
          </Field>
          {selectedEngine && (
            <p className="muted">
              Cliente propietario: <strong>{selectedEngine.client.name}</strong> (se asigna automáticamente)
            </p>
          )}

          <div className="form__row">
            <Field label="Fecha de recepción" htmlFor="reception_date" error={errors.reception_date?.message} required>
              <input id="reception_date" type="date" max={todayIso()} {...register('reception_date')} />
            </Field>
            <Field
              label="Fecha estimada de entrega"
              htmlFor="estimated_delivery_date"
              error={errors.estimated_delivery_date?.message}
              required
            >
              <input id="estimated_delivery_date" type="date" {...register('estimated_delivery_date')} />
            </Field>
          </div>

          <Field label="Técnico responsable" htmlFor="technician" error={errors.technician?.message} required>
            <input id="technician" placeholder="Nombre del técnico" {...register('technician')} />
          </Field>

          <Field label="Problema reportado" htmlFor="reported_problem" error={errors.reported_problem?.message} required>
            <textarea id="reported_problem" rows={3} {...register('reported_problem')} />
          </Field>

          <Field
            label="Diagnóstico técnico"
            htmlFor="diagnosis"
            error={errors.diagnosis?.message}
            hint="Opcional: también puede registrarse al avanzar el estado"
          >
            <textarea id="diagnosis" rows={3} {...register('diagnosis')} />
          </Field>

          <Field
            label="Trabajo realizado o reparación requerida"
            htmlFor="work_performed"
            error={errors.work_performed?.message}
            hint="Opcional"
          >
            <textarea id="work_performed" rows={3} {...register('work_performed')} />
          </Field>

          <Field label="Observaciones" htmlFor="observations" error={errors.observations?.message}>
            <textarea id="observations" rows={2} {...register('observations')} />
          </Field>

          <div className="form__actions">
            <Link to="/orders" className="btn btn--ghost">
              Cancelar
            </Link>
            <button type="submit" className="btn btn--primary" disabled={mutation.isPending}>
              {mutation.isPending ? 'Creando…' : 'Crear orden'}
            </button>
          </div>
        </form>
      )}
    </>
  );
}
