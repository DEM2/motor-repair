/**
 * Estructura común de las pantallas autenticadas: barra lateral de navegación,
 * datos del usuario y botón de cierre de sesión.
 */
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ROLE_LABELS } from '../utils/labels';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: '▦', end: true },
  { to: '/orders', label: 'Órdenes', icon: '⚙' },
  { to: '/engines', label: 'Motores', icon: '⛭' },
  { to: '/clients', label: 'Clientes', icon: '◉' },
];

export function Layout() {
  const { user, isAdmin, logout } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <img src="/favicon.svg" alt="" width={32} height={32} />
          <div>
            <strong>Taller de Motores</strong>
            <span>Minería pesada</span>
          </div>
        </div>

        <nav className="sidebar__nav" aria-label="Navegación principal">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className="sidebar__link">
              <span aria-hidden="true">{item.icon}</span> {item.label}
            </NavLink>
          ))}
          {isAdmin && (
            <NavLink to="/users" className="sidebar__link">
              <span aria-hidden="true">⚑</span> Usuarios
            </NavLink>
          )}
        </nav>

        <div className="sidebar__user">
          <div>
            <strong>{user?.fullName}</strong>
            <span>
              {user?.email} · {user ? ROLE_LABELS[user.role] : ''}
            </span>
          </div>
          <button type="button" className="btn btn--ghost btn--small" onClick={() => logout()}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
