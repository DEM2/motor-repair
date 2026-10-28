/**
 * Formulario para avanzar el estado de una orden.
 *
 * Solo ofrece los estados que el backend indica como válidos (`allowed_next_statuses`)
 * y muestra los campos adicionales que cada transición necesita:
 *   - Esperando aprobación → diagnóstico técnico (obligatorio)
 *   - Finalizado           → trabajo realizado (obligatorio)
 *   - Entregado            → fecha real de entrega
 * El backend vuelve a validar todas estas reglas.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { repairOrdersApi, type StatusChangeInput } from '../../api/endpoints';
import type { RepairOrder, RepairStatus } from '../../api/types';
import { useToast } from '../../components/Toast';
import { ErrorAlert, Field } from '../../components/ui';
import { todayIso } from '../../utils/format';
import { STATUS_LABELS } from '../../utils/labels';

export function StatusChangeForm({ order }: { order: RepairOrder }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const allowed = order.allowed_next_statuses;

  const [status, setStatus] = useState<RepairStatus | ''>(allowed[0] ?? '');
  const [note, setNote] = useState('');
  const [diagnosis, setDiagnosis] = useState(order.diagnosis ?? '');
  const [workPerformed, setWorkPerformed] = useState(order.work_performed ?? '');
  const [deliveryDate, setDeliveryDate] = useState(todayIso());
  const [validationError, setValidationError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (input: StatusChangeInput) => repairOrdersApi.changeStatus(order.id, input),
    onSuccess: (updated) => {
      queryClient.setQueryData(['repair-orders', 'detail', order.id], updated);
      queryClient.invalidateQueries({ queryKey: ['repair-orders', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['repair-orders', 'summary'] });
      toast.success(`Estado actualizado a "${STATUS_LABELS[updated.status]}"`);
      setNote('');
      setStatus(updated.allowed_next_statuses[0] ?? '');
    },
  });

  if (allowed.length === 0) {
    return <p className="muted">La orden fue entregada: el proceso de reparación terminó y no admite más cambios.</p>;
  }

  const needsDiagnosis = status === 'AWAITING_APPROVAL';
  const needsWork = status === 'COMPLETED';
  const needsDelivery = status === 'DELIVERED';

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setValidationError(null);
    if (!status) return setValidationError('Seleccione el nuevo estado');
    if (needsDiagnosis && diagnosis.trim().length < 3) return setValidationError('Registre el diagnóstico técnico');
    if (needsWork && workPerformed.trim().length < 3) return setValidationError('Registre el trabajo realizado');
    if (needsDelivery && deliveryDate < order.reception_date) {
      return setValidationError('La fecha de entrega no puede ser anterior a la recepción');
    }

    const input: StatusChangeInput = { status };
    if (note.trim()) input.note = note.trim();
    if (needsDiagnosis) input.diagnosis = diagnosis.trim();
    if (needsWork) input.work_performed = workPerformed.trim();
    if (needsDelivery) input.actual_delivery_date = deliveryDate;
    mutation.mutate(input);
  };

  return (
    <form className="form" onSubmit={onSubmit} noValidate>
      {validationError && (
        <div className="alert alert--error" role="alert">
          {validationError}
        </div>
      )}
      <ErrorAlert error={mutation.error} title="No se pudo cambiar el estado" />

      <Field label="Nuevo estado" htmlFor="status" required>
        <select id="status" value={status} onChange={(e) => setStatus(e.target.value as RepairStatus)}>
          {allowed.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </Field>

      {needsDiagnosis && (
        <Field label="Diagnóstico técnico" htmlFor="diagnosis" hint="Obligatorio para solicitar aprobación" required>
          <textarea id="diagnosis" rows={3} value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} />
        </Field>
      )}

      {needsWork && (
        <Field label="Trabajo realizado" htmlFor="work_performed" hint="Obligatorio para finalizar" required>
          <textarea id="work_performed" rows={3} value={workPerformed} onChange={(e) => setWorkPerformed(e.target.value)} />
        </Field>
      )}

      {needsDelivery && (
        <Field label="Fecha real de entrega" htmlFor="actual_delivery_date" required>
          <input
            id="actual_delivery_date"
            type="date"
            min={order.reception_date}
            value={deliveryDate}
            onChange={(e) => setDeliveryDate(e.target.value)}
          />
        </Field>
      )}

      <Field label="Nota para el historial" htmlFor="note" hint="Opcional">
        <textarea id="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>

      <button type="submit" className="btn btn--primary" disabled={mutation.isPending}>
        {mutation.isPending ? 'Guardando…' : 'Cambiar estado'}
      </button>
    </form>
  );
}
