/**
 * Definición de rutas de la aplicación.
 */
import { Link, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { Layout } from './components/Layout';
import { EmptyState } from './components/ui';
import { ClientDetailPage } from './pages/clients/ClientDetailPage';
import { ClientFormPage } from './pages/clients/ClientFormPage';
import { ClientsListPage } from './pages/clients/ClientsListPage';
import { DashboardPage } from './pages/DashboardPage';
import { EngineDetailPage } from './pages/engines/EngineDetailPage';
import { EngineFormPage } from './pages/engines/EngineFormPage';
import { EnginesListPage } from './pages/engines/EnginesListPage';
import { LoginPage } from './pages/LoginPage';
import { OrderCreatePage } from './pages/orders/OrderCreatePage';
import { OrderDetailPage } from './pages/orders/OrderDetailPage';
import { OrdersListPage } from './pages/orders/OrdersListPage';
import { UsersPage } from './pages/users/UsersPage';

function NotFound() {
  return (
    <EmptyState title="Página no encontrada">
      <Link to="/">Ir al dashboard</Link>
    </EmptyState>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />

          <Route path="orders" element={<OrdersListPage />} />
          <Route path="orders/new" element={<OrderCreatePage />} />
          <Route path="orders/:id" element={<OrderDetailPage />} />

          <Route path="engines" element={<EnginesListPage />} />
          <Route path="engines/new" element={<EngineFormPage />} />
          <Route path="engines/:id" element={<EngineDetailPage />} />
          <Route path="engines/:id/edit" element={<EngineFormPage />} />

          <Route path="clients" element={<ClientsListPage />} />
          <Route path="clients/new" element={<ClientFormPage />} />
          <Route path="clients/:id" element={<ClientDetailPage />} />
          <Route path="clients/:id/edit" element={<ClientFormPage />} />

          <Route element={<ProtectedRoute adminOnly />}>
            <Route path="users" element={<UsersPage />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  );
}
