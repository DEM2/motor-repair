import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { enginesApi, repairOrdersApi } from '../../api/endpoints';
import { StatusBadge } from '../../components/StatusBadge';
import { ActiveBadge, DetailItem, EmptyState, ErrorAlert, LoadingState, PageHeader } from '../../components/ui';
import { formatDate, formatDateTime } from '../../utils/format';

export function EngineDetailPage() {
  const { id = '' } = useParams();
  const engine = useQuery({ queryKey: ['engines', 'detail', id], queryFn: () => enginesApi.get(id) });
  const orders = useQuery({
    queryKey: ['repair-orders', 'list', { engine_id: id }],
    queryFn: () => repairOrdersApi.list({ engine_id: id, size: 50 }),
  });

  if (engine.isLoading) return <LoadingState />;
  if (engine.error || !engine.data) return <ErrorAlert error={engine.error} title="No se pudo cargar el motor" />;
  const e = engine.data;
  const hasOpenOrder = orders.data?.items.some((o) => o.status !== 'DELIVERED') ?? false;

  return (
    <>
      <PageHeader
        title={`Motor ${e.serial_number}`}
        subtitle={<ActiveBadge active={e.is_active} />}
        actions={
          <>
            <Link to="/engines" className="btn btn--ghost">
              ← Volver
            </Link>
            <Link to={`/engines/${e.id}/edit`} className="btn btn--secondary">
              Editar
            </Link>
            {e.is_active && !hasOpenOrder && (
              <Link to={`/orders/new?engineId=${e.id}`} className="btn btn--primary">
                + Orden de reparación
              </Link>
            )}
          </>
        }
      />

      <section className="card">
        <dl className="details">
          <DetailItem label="Fabricante">{e.manufacturer}</DetailItem>
          <DetailItem label="Modelo">{e.model}</DetailItem>
          <DetailItem label="Tipo de motor">{e.engine_type}</DetailItem>
          <DetailItem label="Potencia / capacidad">{e.power}</DetailItem>
          <DetailItem label="Cliente propietario">
            <Link to={`/clients/${e.client.id}`}>{e.client.name}</Link>
          </DetailItem>
          <DetailItem label="Fecha de registro">{formatDateTime(e.registered_at)}</DetailItem>
        </dl>
      </section>

      <section className="card">
        <h2 className="card__title">Historial de reparaciones</h2>
        {orders.isLoading && <LoadingState />}
        <ErrorAlert error={orders.error} />
        {orders.data?.items.length === 0 && <EmptyState title="Este motor no tiene órdenes de reparación" />}
        {orders.data && orders.data.items.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Orden</th>
                  <th>Recepción</th>
                  <th>Técnico</th>
                  <th>Entrega</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {orders.data.items.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link to={`/orders/${o.id}`}>{o.order_number}</Link>
                    </td>
                    <td>{formatDate(o.reception_date)}</td>
                    <td>{o.technician}</td>
                    <td>{formatDate(o.actual_delivery_date ?? o.estimated_delivery_date)}</td>
                    <td>
                      <StatusBadge status={o.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
