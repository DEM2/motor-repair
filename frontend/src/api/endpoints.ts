/**
 * Funciones de acceso a cada endpoint. Las páginas usan estas funciones (a través de
 * React Query) y nunca construyen URLs a mano.
 */
import { authHttp, businessHttp } from './http';
import type {
  Client,
  Engine,
  IdentificationType,
  LoginResponse,
  Page,
  RepairOrder,
  RepairOrderListItem,
  RepairOrderSummary,
  RepairStatus,
  Role,
  User,
} from './types';

// ── auth-service ──────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    authHttp<LoginResponse>('/api/auth/login', { method: 'POST', body: { email, password }, auth: false }),
  me: () => authHttp<User>('/api/auth/me'),
};

export interface CreateUserInput {
  email: string;
  fullName: string;
  password: string;
  role: Role;
}

export const usersApi = {
  list: () => authHttp<User[]>('/api/users'),
  create: (input: CreateUserInput) => authHttp<User>('/api/auth/register', { method: 'POST', body: input }),
  update: (id: string, input: Partial<CreateUserInput>) =>
    authHttp<User>(`/api/users/${id}`, { method: 'PATCH', body: input }),
  setActive: (id: string, active: boolean) =>
    authHttp<User>(`/api/users/${id}/${active ? 'activate' : 'deactivate'}`, { method: 'PATCH' }),
};

// ── business-service ──────────────────────────────────────────
export interface ClientInput {
  name: string;
  identification_type: IdentificationType;
  identification_number: string;
  email: string;
  is_active: boolean;
}

export interface ClientFilters {
  q?: string;
  is_active?: boolean;
  page?: number;
  size?: number;
}

export const clientsApi = {
  list: (filters: ClientFilters = {}) => businessHttp<Page<Client>>('/api/clients', { query: { ...filters } }),
  get: (id: string) => businessHttp<Client>(`/api/clients/${id}`),
  create: (input: ClientInput) => businessHttp<Client>('/api/clients', { method: 'POST', body: input }),
  update: (id: string, input: Partial<ClientInput>) =>
    businessHttp<Client>(`/api/clients/${id}`, { method: 'PATCH', body: input }),
};

export interface EngineInput {
  serial_number: string;
  manufacturer: string;
  model: string;
  engine_type: string;
  power: string;
  client_id: string;
  is_active: boolean;
}

export interface EngineFilters {
  q?: string;
  client_id?: string;
  is_active?: boolean;
  page?: number;
  size?: number;
}

export const enginesApi = {
  list: (filters: EngineFilters = {}) => businessHttp<Page<Engine>>('/api/engines', { query: { ...filters } }),
  get: (id: string) => businessHttp<Engine>(`/api/engines/${id}`),
  create: (input: EngineInput) => businessHttp<Engine>('/api/engines', { method: 'POST', body: input }),
  update: (id: string, input: Partial<EngineInput>) =>
    businessHttp<Engine>(`/api/engines/${id}`, { method: 'PATCH', body: input }),
};

export interface RepairOrderInput {
  engine_id: string;
  reception_date: string;
  reported_problem: string;
  diagnosis?: string;
  work_performed?: string;
  technician: string;
  estimated_delivery_date: string;
  observations?: string;
}

export interface StatusChangeInput {
  status: RepairStatus;
  note?: string;
  diagnosis?: string;
  work_performed?: string;
  actual_delivery_date?: string;
}

export interface RepairOrderFilters {
  q?: string;
  status?: RepairStatus;
  client_id?: string;
  engine_id?: string;
  page?: number;
  size?: number;
}

export const repairOrdersApi = {
  list: (filters: RepairOrderFilters = {}) =>
    businessHttp<Page<RepairOrderListItem>>('/api/repair-orders', { query: { ...filters } }),
  summary: () => businessHttp<RepairOrderSummary>('/api/repair-orders/summary'),
  get: (id: string) => businessHttp<RepairOrder>(`/api/repair-orders/${id}`),
  create: (input: RepairOrderInput) =>
    businessHttp<RepairOrder>('/api/repair-orders', { method: 'POST', body: input }),
  changeStatus: (id: string, input: StatusChangeInput) =>
    businessHttp<RepairOrder>(`/api/repair-orders/${id}/status`, { method: 'PATCH', body: input }),
};
