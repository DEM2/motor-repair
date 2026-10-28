/**
 * Pruebas de integración de /api/users: consulta, actualización, roles y desactivación.
 */
import request from 'supertest';
import { createApp } from '../../src/app';
import { UserRole } from '../../src/entities/User';
import { DEFAULT_PASSWORD, bearerFor, clearUsers, closeDatabase, createUser, setupDatabase } from '../helpers';

const app = createApp();

beforeAll(setupDatabase);
beforeEach(clearUsers);
afterAll(closeDatabase);

describe('GET /api/users', () => {
  it('lista usuarios para ADMIN sin exponer hashes', async () => {
    const admin = await createUser({ role: UserRole.ADMIN });
    await createUser();
    const res = await request(app).get('/api/users').set('Authorization', bearerFor(admin));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });

  it('prohíbe el listado a un OPERATOR', async () => {
    const operator = await createUser();
    const res = await request(app).get('/api/users').set('Authorization', bearerFor(operator));
    expect(res.status).toBe(403);
  });
});

describe('GET /api/users/:id', () => {
  it('un OPERATOR puede verse a sí mismo pero no a otros', async () => {
    const operator = await createUser();
    const other = await createUser();
    expect((await request(app).get(`/api/users/${operator.id}`).set('Authorization', bearerFor(operator))).status).toBe(200);
    expect((await request(app).get(`/api/users/${other.id}`).set('Authorization', bearerFor(operator))).status).toBe(403);
  });

  it('responde 404 si no existe y 400 si el id no es un UUID', async () => {
    const admin = await createUser({ role: UserRole.ADMIN });
    const missing = await request(app)
      .get('/api/users/00000000-0000-4000-8000-000000000000')
      .set('Authorization', bearerFor(admin));
    expect(missing.status).toBe(404);
    const invalid = await request(app).get('/api/users/123').set('Authorization', bearerFor(admin));
    expect(invalid.status).toBe(400);
  });
});

describe('PATCH /api/users/:id', () => {
  it('un ADMIN puede cambiar el rol y el nombre de otro usuario', async () => {
    const admin = await createUser({ role: UserRole.ADMIN });
    const operator = await createUser();
    const res = await request(app)
      .patch(`/api/users/${operator.id}`)
      .set('Authorization', bearerFor(admin))
      .send({ role: 'ADMIN', fullName: 'Jefe de Taller' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ role: 'ADMIN', fullName: 'Jefe de Taller' });
  });

  it('un OPERATOR puede cambiar su propia contraseña pero no su rol', async () => {
    const operator = await createUser({ email: 'op@taller.local' });

    const changeRole = await request(app)
      .patch(`/api/users/${operator.id}`)
      .set('Authorization', bearerFor(operator))
      .send({ role: 'ADMIN' });
    expect(changeRole.status).toBe(403);

    const changePassword = await request(app)
      .patch(`/api/users/${operator.id}`)
      .set('Authorization', bearerFor(operator))
      .send({ password: 'NuevaClave456' });
    expect(changePassword.status).toBe(200);

    const loginOld = await request(app).post('/api/auth/login').send({ email: 'op@taller.local', password: DEFAULT_PASSWORD });
    const loginNew = await request(app).post('/api/auth/login').send({ email: 'op@taller.local', password: 'NuevaClave456' });
    expect(loginOld.status).toBe(401);
    expect(loginNew.status).toBe(200);
  });

  it('un OPERATOR no puede modificar a otro usuario', async () => {
    const operator = await createUser();
    const other = await createUser();
    const res = await request(app)
      .patch(`/api/users/${other.id}`)
      .set('Authorization', bearerFor(operator))
      .send({ fullName: 'Hackeado' });
    expect(res.status).toBe(403);
  });

  it('un ADMIN no puede quitarse a sí mismo el rol de administrador', async () => {
    const admin = await createUser({ role: UserRole.ADMIN });
    const res = await request(app)
      .patch(`/api/users/${admin.id}`)
      .set('Authorization', bearerFor(admin))
      .send({ role: 'OPERATOR' });
    expect(res.status).toBe(400);
  });

  it('rechaza un correo duplicado, campos desconocidos y cuerpos vacíos', async () => {
    const admin = await createUser({ role: UserRole.ADMIN });
    const a = await createUser({ email: 'a@taller.local' });
    await createUser({ email: 'b@taller.local' });
    const auth = bearerFor(admin);

    expect((await request(app).patch(`/api/users/${a.id}`).set('Authorization', auth).send({ email: 'b@taller.local' })).status).toBe(409);
    expect((await request(app).patch(`/api/users/${a.id}`).set('Authorization', auth).send({ isAdmin: true })).status).toBe(400);
    expect((await request(app).patch(`/api/users/${a.id}`).set('Authorization', auth).send({})).status).toBe(400);
  });
});

describe('PATCH /api/users/:id/deactivate y /activate', () => {
  it('desactiva un usuario (no puede iniciar sesión) y lo reactiva', async () => {
    const admin = await createUser({ role: UserRole.ADMIN });
    const operator = await createUser({ email: 'op@taller.local' });
    const auth = bearerFor(admin);

    const deactivated = await request(app).patch(`/api/users/${operator.id}/deactivate`).set('Authorization', auth);
    expect(deactivated.status).toBe(200);
    expect(deactivated.body.isActive).toBe(false);

    const blocked = await request(app).post('/api/auth/login').send({ email: 'op@taller.local', password: DEFAULT_PASSWORD });
    expect(blocked.status).toBe(403);

    const activated = await request(app).patch(`/api/users/${operator.id}/activate`).set('Authorization', auth);
    expect(activated.body.isActive).toBe(true);
  });

  it('un ADMIN no puede desactivarse a sí mismo', async () => {
    const admin = await createUser({ role: UserRole.ADMIN });
    const res = await request(app).patch(`/api/users/${admin.id}/deactivate`).set('Authorization', bearerFor(admin));
    expect(res.status).toBe(400);
  });

  it('un OPERATOR no puede desactivar usuarios', async () => {
    const operator = await createUser();
    const other = await createUser();
    const res = await request(app).patch(`/api/users/${other.id}/deactivate`).set('Authorization', bearerFor(operator));
    expect(res.status).toBe(403);
  });
});
