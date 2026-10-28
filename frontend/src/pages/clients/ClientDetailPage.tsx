import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { clientsApi, enginesApi, repairOrdersApi } from '../../api/endpoints';
import { StatusBadge } from '../../components/StatusBadge';
import { ActiveBadge, DetailItem, EmptyState, ErrorAlert, LoadingState, PageHeader } from '../../components/ui';
import { formatDate, formatDateTime } from '../../utils/format';
import { IDENTIFICATION_TYPE_LABELS } from '../../utils/labels';

export function ClientDetailPage() {
  const { id = '' } = useParams();
  const client = useQuery({ queryKey: ['clients', 'detail', id], queryFn: () => clientsApi.get(id) });
  const engines = useQuery({
    queryKey: ['engines', 'list', { client_id: id }],
    queryFn: () => enginesApi.list({ client_id: id, size: 100 }),
  });
  const orders = useQuery({
    queryKey: ['repair-orders', 'list', { client_id: id }],
    queryFn: () => repairOrdersApi.list({ client_id: id, size: 10 }),
  });

  if (client.isLoading) return <LoadingState />;
  if (client.error || !client.data) return <ErrorAlert error={client.error} title="No se pudo cargar el cliente" />;
  const c = client.data;

  return (
    <>
      <PageHeader
        title={c.name}
        subtitle={<ActiveBadge active={c.is_active} />}
        actions={
          <>
            <Link to="/clients" className="btn btn--ghost">
              ← Volver
            </Link>
            <Link to={`/clients/${c.id}/edit`} className="btn btn--secondary">
              Editar
            </Link>
          </>
        }
      />

      <section className="card">
        <dl className="details">
          <DetailItem label="Tipo de identificación">{IDENTIFICATION_TYPE_LABELS[c.identification_type]}</DetailItem>
          <DetailItem label="Número de identificación">{c.identification_number}</DetailItem>
          <DetailItem label="Correo electrónico">{c.email}</DetailItem>
          <DetailItem label="Registrado">{formatDateTime(c.created_at)}</DetailItem>
          <DetailItem label="Última actualización">{formatDateTime(c.updated_at)}</DetailItem>
        </dl>
      </section>

      <section className="card">
        <div className="card__header">
          <h2 className="card__title">Motores del cliente</h2>
          {c.is_active && (
            <Link to={`/engines/new?clientId=${c.id}`} className="btn btn--secondary btn--small">
              + Registrar motor
            </Link>
          )}
        </div>
        {engines.isLoading && <LoadingState />}
        <ErrorAlert error={engines.error} />
        {engines.data?.items.length === 0 && <EmptyState title="Este cliente no tiene motores registrados" />}
        {engines.data && engines.data.items.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Serie</th>
                  <th>Fabricante / modelo</th>
                  <th>Potencia</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {engines.data.items.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <Link to={`/engines/${e.id}`}>{e.serial_number}</Link>
                    </td>
                    <td>
                      {e.manufacturer} {e.model}
                    </td>
                    <td>{e.power}</td>
                    <td>
                      <ActiveBadge active={e.is_active} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <div className="card__header">
          <h2 className="card__title">Órdenes recientes</h2>
          <Link to={`/orders?client_id=${c.id}`}>Ver todas →</Link>
        </div>
        {orders.data?.items.length === 0 && <EmptyState title="Sin órdenes de reparación" />}
        {orders.data && orders.data.items.length > 0 && (
          <ul className="list">
            {orders.data.items.map((o) => (
              <li key={o.id}>
                <Link to={`/orders/${o.id}`}>{o.order_number}</Link> · {o.engine.serial_number} · recibido{' '}
                {formatDate(o.reception_date)} <StatusBadge status={o.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
