// Prueba de humo de punta a punta contra la plataforma desplegada (Docker Compose).
//
// Recorre el flujo real entre servicios:
//   1. Login en auth-service -> obtiene un JWT RS256.
//   2. Verifica que business-service rechaza peticiones sin token o con token alterado.
//   3. Crea cliente, motor y orden en business-service usando el JWT.
//   4. Lleva la orden por todo su ciclo de vida hasta "Entregado".
//
// Uso:  node scripts/smoke-test.mjs
// Variables opcionales: AUTH_URL, BUSINESS_URL, ADMIN_EMAIL, ADMIN_PASSWORD
const AUTH_URL = process.env.AUTH_URL ?? 'http://localhost:4000';
const BUSINESS_URL = process.env.BUSINESS_URL ?? 'http://localhost:8000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@taller.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'change-me-Admin123';

let step = 0;
function check(condition, message) {
  step += 1;
  if (!condition) {
    console.error(`✗ [${step}] ${message}`);
    process.exit(1);
  }
  console.log(`✓ [${step}] ${message}`);
}

async function call(base, path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => null);
  return { status: response.status, data };
}

/** Espera a que ambos servicios respondan /health (útil justo después de `docker compose up`). */
async function waitForServices(timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  for (const base of [AUTH_URL, BUSINESS_URL]) {
    for (;;) {
      try {
        const { status } = await call(base, '/health');
        if (status === 200) break;
      } catch {
        // el servicio aún no acepta conexiones
      }
      if (Date.now() > deadline) throw new Error(`${base} no respondió a tiempo`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

await waitForServices();
check(true, 'auth-service y business-service están saludables');

const login = await call(AUTH_URL, '/api/auth/login', {
  method: 'POST',
  body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
});
check(login.status === 200 && login.data?.accessToken, 'Login en auth-service devuelve un JWT');
const token = login.data.accessToken;
const header = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString());
check(header.alg === 'RS256', 'El token está firmado con RS256');

check((await call(BUSINESS_URL, '/api/clients')).status === 401, 'business-service rechaza peticiones sin token');
const tampered = `${token.slice(0, -4)}AAAA`;
check(
  (await call(BUSINESS_URL, '/api/clients', { token: tampered })).status === 401,
  'business-service rechaza un token con la firma alterada',
);

const suffix = Date.now().toString().slice(-6);
const client = await call(BUSINESS_URL, '/api/clients', {
  method: 'POST',
  token,
  body: {
    name: `Minera Smoke ${suffix}`,
    identification_type: 'NIT',
    identification_number: `900${suffix}-1`,
    email: 'smoke@minera.co',
  },
});
check(client.status === 201, 'Se crea un cliente usando el JWT emitido por auth-service');

const engine = await call(BUSINESS_URL, '/api/engines', {
  method: 'POST',
  token,
  body: {
    serial_number: `SMOKE-${suffix}`,
    manufacturer: 'Caterpillar',
    model: '3516B',
    engine_type: 'Diésel V16',
    power: '2000 HP',
    client_id: client.data.id,
  },
});
check(engine.status === 201, 'Se registra un motor');

const today = new Date().toISOString().slice(0, 10);
const order = await call(BUSINESS_URL, '/api/repair-orders', {
  method: 'POST',
  token,
  body: {
    engine_id: engine.data.id,
    reception_date: today,
    estimated_delivery_date: today,
    reported_problem: 'Prueba de humo del pipeline',
    technician: 'Técnico CI',
  },
});
check(order.status === 201 && order.data.status === 'RECEIVED', `Se crea la orden ${order.data?.order_number}`);

const transitions = [
  { status: 'IN_DIAGNOSIS' },
  { status: 'AWAITING_APPROVAL', diagnosis: 'Diagnóstico de prueba' },
  { status: 'IN_REPAIR' },
  { status: 'IN_TESTING' },
  { status: 'COMPLETED', work_performed: 'Trabajo de prueba' },
  { status: 'DELIVERED' },
];
let last;
for (const body of transitions) {
  last = await call(BUSINESS_URL, `/api/repair-orders/${order.data.id}/status`, { method: 'PATCH', token, body });
  check(last.status === 200, `Transición a ${body.status}`);
}
check(last.data.status_history.length === 7, 'El historial registra los 7 estados de la orden');

console.log('\nPrueba de humo completada con éxito.');
