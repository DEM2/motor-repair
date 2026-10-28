import type { RepairStatus } from '../api/types';
import { STATUS_LABELS } from '../utils/labels';

/** Etiqueta de color para el estado de una orden (el color se define en styles.css). */
export function StatusBadge({ status }: { status: RepairStatus }) {
  return <span className={`badge status status--${status.toLowerCase()}`}>{STATUS_LABELS[status]}</span>;
}
