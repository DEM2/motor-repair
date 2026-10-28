/**
 * Listado de órdenes con búsqueda libre y filtros por estado, cliente y motor.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useDeferredValue } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { clientsApi, enginesApi, repairOrdersApi } from '../../api/endpoints';
import type { RepairStatus } from '../../api/types';
import { StatusBadge } from '../../components/StatusBadge';
import { EmptyState, ErrorAlert, LoadingState, PageHeader, Pagination } from '../../components/ui';
import { formatDate } from '../../utils/format';
import { REPAIR_STATUSES, STATUS_LABELS } from '../../utils/labels';
import { useListParams } from '../../utils/useListParams';

export function OrdersListPage() {
  const navigate = useNavigate();
  const { values, page, setFilter, setPage } = useListParams(['q', 'status', 'client_id', 'engine_id'] as const);
  const q = useDeferredValue(values.q);
  const filters = {
    q,
    status: (values.status || undefined) as RepairStatus | undefined,
    client_id: values.client_id || undefined,
    engine_id: values.engine_id || undefined,
    page,
    size: 10,
  };

  const clients = useQuery({ queryKey: ['clients', 'options'], queryFn: () => clientsApi.list({ size: 100 }) });
  const engines = useQuery({
    queryKey: ['engines', 'options', values.client_id],
    queryFn: () => enginesApi.list({ client_id: values.client_id || undefined, size: 100 }),
  });
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['repair-orders', 'list', filters],
    queryFn: () => repairOrdersApi.list(filters),
    placeholderData: keepPreviousData,
  });

  const hasFilters = Boolean(values.q || values.status || values.client_id || values.engine_id);

  return (
    <>
      <PageHeader
        title="Órdenes de reparación"
        subtitle="Seguimiento de los motores en el taller"
        actions={
          <Link to="/orders/new" className="btn btn--primary">
            + Nueva orden
          </Link>
        }
      />

      <div className="card">
        <div className="filters">
          <input
            type="search"
            placeholder="Buscar por número, serie, cliente, técnico o problema…"
            value={values.q}
            onChange={(e) => setFilter('q', e.target.value)}
            aria-label="Buscar órdenes"
          />
          <select value={values.status} onChange={(e) => setFilter('status', e.target.value)} aria-label="Estado">
            <option value="">Todos los estados</option>
            {REPAIR_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <select value={values.client_id} onChange={(e) => setFilter('client_id', e.target.value)} aria-label="Cliente">
            <option value="">Todos los clientes</option>
            {clients.data?.items.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select value={values.engine_id} onChange={(e) => setFilter('engine_id', e.target.value)} aria-label="Motor">
            <option value="">Todos los motores</option>
            {engines.data?.items.map((e) => (
              <option key={e.id} value={e.id}>
                {e.serial_number} · {e.manufacturer}
              </option>
            ))}
          </select>
          {hasFilters && (
            <button type="button" className="btn btn--ghost btn--small" onClick={() => navigate('/orders')}>
              Limpiar filtros
            </button>
          )}
          {isFetching && !isLoading && <span className="muted">Actualizando…</span>}
        </div>

        {isLoading && <LoadingState />}
        <ErrorAlert error={error} />
        {data && data.items.length === 0 && (
          <EmptyState title={hasFilters ? 'Ninguna orden coincide con los filtros' : 'Aún no hay órdenes de reparación'} />
        )}

        {data && data.items.length > 0 && (
          <>
            <div className="table-wrap">
              <table className="table table--clickable">
                <thead>
                  <tr>
                    <th>Orden</th>
                    <th>Motor</th>
                    <th>Cliente</th>
                    <th>Técnico</th>
                    <th>Recepción</th>
                    <th>Entrega estimada</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((o) => (
                    <tr key={o.id} onClick={() => navigate(`/orders/${o.id}`)}>
                      <td>
                        <Link to={`/orders/${o.id}`} onClick={(ev) => ev.stopPropagation()}>
                          {o.order_number}
                        </Link>
                      </td>
                      <td>
                        {o.engine.serial_number}
                        <div className="muted small">
                          {o.engine.manufacturer} {o.engine.model}
                        </div>
                      </td>
                      <td>{o.client.name}</td>
                      <td>{o.technician}</td>
                      <td>{formatDate(o.reception_date)}</td>
                      <td>{formatDate(o.estimated_delivery_date)}</td>
                      <td>
                        <StatusBadge status={o.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />
          </>
        )}
      </div>
    </>
  );
}
