/**
 * Detalle de una orden: información completa, historial de estados y cambio de estado.
 */
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { repairOrdersApi } from '../../api/endpoints';
import { StatusBadge } from '../../components/StatusBadge';
import { DetailItem, ErrorAlert, LoadingState, PageHeader } from '../../components/ui';
import { formatDate, formatDateTime } from '../../utils/format';
import { REPAIR_STATUSES, STATUS_LABELS } from '../../utils/labels';
import { StatusChangeForm } from './StatusChangeForm';

export function OrderDetailPage() {
  const { id = '' } = useParams();
  const { data: order, isLoading, error } = useQuery({
    queryKey: ['repair-orders', 'detail', id],
    queryFn: () => repairOrdersApi.get(id),
  });

  if (isLoading) return <LoadingState />;
  if (error || !order) return <ErrorAlert error={error} title="No se pudo cargar la orden" />;

  const currentIndex = REPAIR_STATUSES.indexOf(order.status);

  return (
    <>
      <PageHeader
        title={`Orden ${order.order_number}`}
        subtitle={<StatusBadge status={order.status} />}
        actions={
          <Link to="/orders" className="btn btn--ghost">
            ← Volver al listado
          </Link>
        }
      />

      {/* Progreso visual del flujo de reparación */}
      <ol className="stepper" aria-label="Progreso de la reparación">
        {REPAIR_STATUSES.map((status, index) => (
          <li
            key={status}
            className={index < currentIndex ? 'is-done' : index === currentIndex ? 'is-current' : ''}
            aria-current={index === currentIndex ? 'step' : undefined}
          >
            <span className="stepper__dot">{index < currentIndex ? '✓' : index + 1}</span>
            <span className="stepper__label">{STATUS_LABELS[status]}</span>
          </li>
        ))}
      </ol>

      <div className="grid-2">
        <section className="card">
          <h2 className="card__title">Información general</h2>
          <dl className="details">
            <DetailItem label="Motor">
              <Link to={`/engines/${order.engine.id}`}>{order.engine.serial_number}</Link>
              <div className="muted small">
                {order.engine.manufacturer} {order.engine.model}
              </div>
            </DetailItem>
            <DetailItem label="Cliente propietario">
              <Link to={`/clients/${order.client.id}`}>{order.client.name}</Link>
              <div className="muted small">{order.client.identification_number}</div>
            </DetailItem>
            <DetailItem label="Técnico responsable">{order.technician}</DetailItem>
            <DetailItem label="Fecha de recepción">{formatDate(order.reception_date)}</DetailItem>
            <DetailItem label="Entrega estimada">{formatDate(order.estimated_delivery_date)}</DetailItem>
            <DetailItem label="Entrega real">{formatDate(order.actual_delivery_date)}</DetailItem>
            <DetailItem label="Creada">
              {formatDateTime(order.created_at)}
              <div className="muted small">por {order.created_by_email}</div>
            </DetailItem>
            <DetailItem label="Última actualización">{formatDateTime(order.updated_at)}</DetailItem>
          </dl>
        </section>

        <section className="card">
          <h2 className="card__title">Actualizar estado</h2>
          <StatusChangeForm order={order} />
        </section>
      </div>

      <section className="card">
        <h2 className="card__title">Detalle técnico</h2>
        <dl className="details details--stacked">
          <DetailItem label="Problema reportado">
            <p className="pre">{order.reported_problem}</p>
          </DetailItem>
          <DetailItem label="Diagnóstico técnico">
            <p className="pre">{order.diagnosis ?? <span className="muted">Pendiente</span>}</p>
          </DetailItem>
          <DetailItem label="Trabajo realizado / reparación requerida">
            <p className="pre">{order.work_performed ?? <span className="muted">Pendiente</span>}</p>
          </DetailItem>
          <DetailItem label="Observaciones">
            <p className="pre">{order.observations ?? <span className="muted">Sin observaciones</span>}</p>
          </DetailItem>
        </dl>
      </section>

      <section className="card">
        <h2 className="card__title">Historial de estados</h2>
        <ol className="timeline">
          {[...order.status_history].reverse().map((entry) => (
            <li key={entry.id} className="timeline__item">
              <div className="timeline__marker" aria-hidden="true" />
              <div>
                <div className="timeline__head">
                  {entry.from_status ? (
                    <>
                      <StatusBadge status={entry.from_status} /> <span aria-hidden="true">→</span>{' '}
                    </>
                  ) : null}
                  <StatusBadge status={entry.to_status} />
                </div>
                {entry.note && <p className="timeline__note">{entry.note}</p>}
                <small className="muted">
                  {formatDateTime(entry.changed_at)} · {entry.changed_by_email}
                </small>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
