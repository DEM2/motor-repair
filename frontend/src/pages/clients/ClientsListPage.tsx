import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useDeferredValue } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { clientsApi } from '../../api/endpoints';
import { ActiveBadge, EmptyState, ErrorAlert, LoadingState, PageHeader, Pagination } from '../../components/ui';
import { IDENTIFICATION_TYPE_LABELS } from '../../utils/labels';
import { useListParams } from '../../utils/useListParams';

export function ClientsListPage() {
  const navigate = useNavigate();
  const { values, page, setFilter, setPage } = useListParams(['q', 'active'] as const);
  // useDeferredValue evita una petición por cada tecla mientras el usuario escribe.
  const q = useDeferredValue(values.q);
  const filters = { q, is_active: values.active === '' ? undefined : values.active === 'true', page, size: 10 };

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['clients', 'list', filters],
    queryFn: () => clientsApi.list(filters),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle="Empresas y personas propietarias de los motores"
        actions={
          <Link to="/clients/new" className="btn btn--primary">
            + Nuevo cliente
          </Link>
        }
      />

      <div className="card">
        <div className="filters">
          <input
            type="search"
            placeholder="Buscar por nombre, identificación o correo…"
            value={values.q}
            onChange={(e) => setFilter('q', e.target.value)}
            aria-label="Buscar clientes"
          />
          <select value={values.active} onChange={(e) => setFilter('active', e.target.value)} aria-label="Estado">
            <option value="">Todos los estados</option>
            <option value="true">Activos</option>
            <option value="false">Inactivos</option>
          </select>
          {isFetching && !isLoading && <span className="muted">Actualizando…</span>}
        </div>

        {isLoading && <LoadingState />}
        <ErrorAlert error={error} />

        {data && data.items.length === 0 && <EmptyState title="No se encontraron clientes" />}

        {data && data.items.length > 0 && (
          <>
            <div className="table-wrap">
              <table className="table table--clickable">
                <thead>
                  <tr>
                    <th>Nombre / razón social</th>
                    <th>Identificación</th>
                    <th>Correo</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((client) => (
                    <tr key={client.id} onClick={() => navigate(`/clients/${client.id}`)}>
                      <td>
                        <Link to={`/clients/${client.id}`} onClick={(e) => e.stopPropagation()}>
                          {client.name}
                        </Link>
                      </td>
                      <td>
                        <span className="muted">{IDENTIFICATION_TYPE_LABELS[client.identification_type]}</span>{' '}
                        {client.identification_number}
                      </td>
                      <td>{client.email}</td>
                      <td>
                        <ActiveBadge active={client.is_active} />
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
