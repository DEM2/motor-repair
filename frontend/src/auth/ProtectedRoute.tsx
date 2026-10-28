/**
 * Protege rutas del frontend: redirige al login si no hay sesión y, opcionalmente,
 * exige el rol ADMIN. Es solo una ayuda de navegación: la seguridad real la aplican
 * las APIs validando el JWT en cada petición.
 */
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

export function ProtectedRoute({ adminOnly = false }: { adminOnly?: boolean }) {
  const { isAuthenticated, isAdmin } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
