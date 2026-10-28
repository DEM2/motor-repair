/**
 * Textos en español para los valores que las APIs envían como códigos.
 * Mantenerlos en un solo lugar evita inconsistencias entre pantallas.
 */
import type { IdentificationType, RepairStatus, Role } from '../api/types';

/** Estados en el orden natural del proceso de reparación. */
export const REPAIR_STATUSES: RepairStatus[] = [
  'RECEIVED',
  'IN_DIAGNOSIS',
  'AWAITING_APPROVAL',
  'IN_REPAIR',
  'IN_TESTING',
  'COMPLETED',
  'DELIVERED',
];

export const STATUS_LABELS: Record<RepairStatus, string> = {
  RECEIVED: 'Recibido',
  IN_DIAGNOSIS: 'En diagnóstico',
  AWAITING_APPROVAL: 'Esperando aprobación',
  IN_REPAIR: 'En reparación',
  IN_TESTING: 'En pruebas',
  COMPLETED: 'Finalizado',
  DELIVERED: 'Entregado',
};

export const IDENTIFICATION_TYPE_LABELS: Record<IdentificationType, string> = {
  NIT: 'NIT',
  CC: 'Cédula de ciudadanía',
  CE: 'Cédula de extranjería',
  PASSPORT: 'Pasaporte',
};

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrador',
  OPERATOR: 'Operativo',
};
