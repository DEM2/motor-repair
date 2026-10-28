import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useDeferredValue } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { clientsApi, enginesApi } from '../../api/endpoints';
import { ActiveBadge, EmptyState, ErrorAlert, LoadingState, PageHeader, Pagination } from '../../components/ui';
import { formatDate } from '../../utils/format';
import { useListParams } from '../../utils/useListParams';

export function EnginesListPage() {
  const navigate = useNavigate();
  const { values, page, setFilter, setPage } = useListParams(['q', 'client_id', 'active'] as const);
  const q = useDeferredValue(values.q);
  const filters = {
    q,
    client_id: values.client_id || undefined,
    is_active: values.active === '' ? undefined : values.active === 'true',
    page,
    size: 10,
  };

  const clients = useQuery({ queryKey: ['clients', 'options'], queryFn: () => clientsApi.list({ size: 100 }) });
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['engines', 'list', filters],
    queryFn: () => enginesApi.list(filters),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader
        title="Motores"
        subtitle="Motores registrados en el taller"
        actions={
          <Link to="/engines/new" className="btn btn--primary">
            + Nuevo motor
          </Link>
        }
      />

      <div className="card">
        <div className="filters">
          <input
            type="search"
            placeholder="Buscar por serie, fabricante, modelo o tipo…"
            value={values.q}
            onChange={(e) => setFilter('q', e.target.value)}
            aria-label="Buscar motores"
          />
          <select value={values.client_id} onChange={(e) => setFilter('client_id', e.target.value)} aria-label="Cliente">
            <option value="">Todos los clientes</option>
            {clients.data?.items.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select value={values.active} onChange={(e) => setFilter('active', e.target.value)} aria-label="Estado">
            <option value="">Todos los estados</option>
            <option value="true">Activos</option>
            <option value="false">Inactivos</option>
          </select>
          {isFetching && !isLoading && <span className="muted">Actualizando…</span>}
        </div>

        {isLoading && <LoadingState />}
        <ErrorAlert error={error} />
        {data && data.items.length === 0 && <EmptyState title="No se encontraron motores" />}

        {data && data.items.length > 0 && (
          <>
            <div className="table-wrap">
              <table className="table table--clickable">
                <thead>
                  <tr>
                    <th>Serie / código</th>
                    <th>Fabricante</th>
                    <th>Modelo</th>
                    <th>Tipo</th>
                    <th>Potencia</th>
                    <th>Cliente</th>
                    <th>Registro</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((e) => (
                    <tr key={e.id} onClick={() => navigate(`/engines/${e.id}`)}>
                      <td>
                        <Link to={`/engines/${e.id}`} onClick={(ev) => ev.stopPropagation()}>
                          {e.serial_number}
                        </Link>
                      </td>
                      <td>{e.manufacturer}</td>
                      <td>{e.model}</td>
                      <td>{e.engine_type}</td>
                      <td>{e.power}</td>
                      <td>{e.client.name}</td>
                      <td>{formatDate(e.registered_at)}</td>
                      <td>
                        <ActiveBadge active={e.is_active} />
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
