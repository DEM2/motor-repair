/**
 * Dashboard: resumen de las órdenes de reparación por estado y últimas órdenes.
 */
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { repairOrdersApi } from '../api/endpoints';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState, ErrorAlert, LoadingState, PageHeader } from '../components/ui';
import { useAuth } from '../auth/AuthContext';
import { formatDate } from '../utils/format';
import { REPAIR_STATUSES, STATUS_LABELS } from '../utils/labels';

export function DashboardPage() {
  const { user } = useAuth();
  const summary = useQuery({ queryKey: ['repair-orders', 'summary'], queryFn: repairOrdersApi.summary });
  const recent = useQuery({
    queryKey: ['repair-orders', 'list', { size: 5 }],
    queryFn: () => repairOrdersApi.list({ size: 5 }),
  });

  const summaryData = summary.data;
  const total = summaryData?.total ?? 0;
  const open = total - (summaryData?.by_status.DELIVERED ?? 0);

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`Hola, ${user?.fullName ?? ''}. Este es el estado actual del taller.`}
        actions={
          <Link to="/orders/new" className="btn btn--primary">
            + Nueva orden
          </Link>
        }
      />

      {summary.isLoading && <LoadingState />}
      <ErrorAlert error={summary.error} title="No se pudo cargar el resumen" />

      {summaryData && (
        <>
          <section className="kpis">
            <div className="kpi kpi--highlight">
              <span>Órdenes abiertas</span>
              <strong>{open}</strong>
            </div>
            <div className="kpi">
              <span>Total histórico</span>
              <strong>{total}</strong>
            </div>
          </section>

          <section className="card">
            <h2 className="card__title">Órdenes por estado</h2>
            <ul className="status-grid">
              {REPAIR_STATUSES.map((status) => {
                const count = summaryData.by_status[status] ?? 0;
                const percent = total ? Math.round((count / total) * 100) : 0;
                return (
                  <li key={status}>
                    <Link to={`/orders?status=${status}`} className="status-tile">
                      <div className="status-tile__head">
                        <StatusBadge status={status} />
                        <strong>{count}</strong>
                      </div>
                      <div className="bar" aria-label={`${STATUS_LABELS[status]}: ${percent}%`}>
                        <span className={`bar__fill status--${status.toLowerCase()}`} style={{ width: `${percent}%` }} />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}

      <section className="card">
        <div className="card__header">
          <h2 className="card__title">Últimas órdenes</h2>
          <Link to="/orders">Ver todas →</Link>
        </div>
        {recent.isLoading && <LoadingState />}
        <ErrorAlert error={recent.error} />
        {recent.data && recent.data.items.length === 0 && (
          <EmptyState title="Aún no hay órdenes de reparación">
            <Link to="/orders/new">Crear la primera orden</Link>
          </EmptyState>
        )}
        {recent.data && recent.data.items.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Orden</th>
                  <th>Motor</th>
                  <th>Cliente</th>
                  <th>Estado</th>
                  <th>Entrega estimada</th>
                </tr>
              </thead>
              <tbody>
                {recent.data.items.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link to={`/orders/${order.id}`}>{order.order_number}</Link>
                    </td>
                    <td>{order.engine.serial_number}</td>
                    <td>{order.client.name}</td>
                    <td>
                      <StatusBadge status={order.status} />
                    </td>
                    <td>{formatDate(order.estimated_delivery_date)}</td>
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
