import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RepairOrder } from '../api/types';
import { StatusBadge } from '../components/StatusBadge';
import { StatusChangeForm } from '../pages/orders/StatusChangeForm';
import { jsonResponse, renderWithProviders } from './utils';

const baseOrder: RepairOrder = {
  id: 'o1',
  order_number: 'OT-2026-000001',
  status: 'IN_DIAGNOSIS',
  reception_date: '2026-01-10',
  estimated_delivery_date: '2026-01-30',
  actual_delivery_date: null,
  technician: 'Carlos Pérez',
  engine: { id: 'e1', serial_number: 'CAT-1', manufacturer: 'Caterpillar', model: '3516B' },
  client: { id: 'c1', name: 'Minera', identification_type: 'NIT', identification_number: '900' },
  created_at: '2026-01-10T10:00:00Z',
  updated_at: '2026-01-10T10:00:00Z',
  engine_id: 'e1',
  client_id: 'c1',
  reported_problem: 'Humo',
  diagnosis: null,
  work_performed: null,
  observations: null,
  created_by_user_id: 'u1',
  created_by_email: 'ana@taller.local',
  allowed_next_statuses: ['AWAITING_APPROVAL'],
  status_history: [],
};

afterEach(() => vi.restoreAllMocks());

describe('StatusBadge', () => {
  it('muestra la etiqueta en español del estado', () => {
    renderWithProviders(<StatusBadge status="AWAITING_APPROVAL" />);
    expect(screen.getByText('Esperando aprobación')).toBeInTheDocument();
  });
});

describe('StatusChangeForm', () => {
  it('solo ofrece los estados permitidos y exige diagnóstico para solicitar aprobación', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    renderWithProviders(<StatusChangeForm order={baseOrder} />);

    const options = screen.getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['Esperando aprobación']);

    await userEvent.click(screen.getByRole('button', { name: 'Cambiar estado' }));
    expect(await screen.findByText('Registre el diagnóstico técnico')).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('envía el cambio de estado con el diagnóstico y la nota', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse({ ...baseOrder, status: 'AWAITING_APPROVAL', allowed_next_statuses: ['IN_REPAIR'] }));
    renderWithProviders(<StatusChangeForm order={baseOrder} />);

    await userEvent.type(screen.getByLabelText(/diagnóstico técnico/i), 'Desgaste de camisas');
    await userEvent.type(screen.getByLabelText(/nota para el historial/i), 'Cotización enviada');
    await userEvent.click(screen.getByRole('button', { name: 'Cambiar estado' }));

    expect(await screen.findByText(/Estado actualizado/)).toBeInTheDocument();
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toBe('http://localhost:8000/api/repair-orders/o1/status');
    expect(JSON.parse(String(init?.body))).toEqual({
      status: 'AWAITING_APPROVAL',
      note: 'Cotización enviada',
      diagnosis: 'Desgaste de camisas',
    });
  });

  it('indica que una orden entregada ya no admite cambios', () => {
    renderWithProviders(<StatusChangeForm order={{ ...baseOrder, status: 'DELIVERED', allowed_next_statuses: [] }} />);
    expect(screen.getByText(/no admite más cambios/)).toBeInTheDocument();
  });
});
