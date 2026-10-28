/** Tipos de los contratos de ambas APIs (reflejan los esquemas OpenAPI). */

// ── auth-service ──────────────────────────────────────────────
export type Role = 'ADMIN' | 'OPERATOR';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: User;
}

// ── business-service ──────────────────────────────────────────
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export type IdentificationType = 'NIT' | 'CC' | 'CE' | 'PASSPORT';

export interface ClientSummary {
  id: string;
  name: string;
  identification_type: IdentificationType;
  identification_number: string;
}

export interface Client extends ClientSummary {
  email: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EngineSummary {
  id: string;
  serial_number: string;
  manufacturer: string;
  model: string;
}

export interface Engine extends EngineSummary {
  engine_type: string;
  power: string;
  client_id: string;
  client: ClientSummary;
  registered_at: string;
  updated_at: string;
  is_active: boolean;
}

export type RepairStatus =
  | 'RECEIVED'
  | 'IN_DIAGNOSIS'
  | 'AWAITING_APPROVAL'
  | 'IN_REPAIR'
  | 'IN_TESTING'
  | 'COMPLETED'
  | 'DELIVERED';

export interface StatusHistoryEntry {
  id: string;
  from_status: RepairStatus | null;
  to_status: RepairStatus;
  note: string | null;
  changed_by_user_id: string;
  changed_by_email: string;
  changed_at: string;
}

export interface RepairOrderListItem {
  id: string;
  order_number: string;
  status: RepairStatus;
  reception_date: string;
  estimated_delivery_date: string;
  actual_delivery_date: string | null;
  technician: string;
  engine: EngineSummary;
  client: ClientSummary;
  created_at: string;
  updated_at: string;
}

export interface RepairOrder extends RepairOrderListItem {
  engine_id: string;
  client_id: string;
  reported_problem: string;
  diagnosis: string | null;
  work_performed: string | null;
  observations: string | null;
  created_by_user_id: string;
  created_by_email: string;
  allowed_next_statuses: RepairStatus[];
  status_history: StatusHistoryEntry[];
}

export interface RepairOrderSummary {
  total: number;
  by_status: Record<RepairStatus, number>;
}
