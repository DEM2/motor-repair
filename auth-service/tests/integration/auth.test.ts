/**
 * Pruebas de integración de /api/auth contra una base de datos PostgreSQL real.
 */
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../src/app';
import { UserRole } from '../../src/entities/User';
import { DEFAULT_PASSWORD, bearerFor, clearUsers, closeDatabase, createUser, setupDatabase } from '../helpers';

const app = createApp();

beforeAll(setupDatabase);
beforeEach(clearUsers);
afterAll(closeDatabase);

describe('POST /api/auth/login', () => {
  it('devuelve un JWT RS256 con identidad y rol del usuario', async () => {
    const user = await createUser({ email: 'ana@taller.local', role: UserRole.ADMIN });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: '  ANA@taller.local ', password: DEFAULT_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ tokenType: 'Bearer', expiresIn: 3600 });
    expect(res.body.user).toMatchObject({ id: user.id, email: 'ana@taller.local', role: 'ADMIN' });
    expect(res.body.user).not.toHaveProperty('passwordHash');

    const decoded = jwt.decode(res.body.accessToken, { complete: true })!;
    expect(decoded.header.alg).toBe('RS256');
    expect(decoded.payload).toMatchObject({ sub: user.id, role: 'ADMIN', email: 'ana@taller.local' });
  });

  it('responde 401 con el mismo mensaje si la contraseña es incorrecta o el correo no existe', async () => {
    await createUser({ email: 'ana@taller.local' });

    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ana@taller.local', password: 'Incorrecta1' });
    const unknownEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nadie@taller.local', password: 'Incorrecta1' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.error.message).toBe(unknownEmail.body.error.message);
  });

  it('responde 403 si el usuario está desactivado', async () => {
    await createUser({ email: 'inactivo@taller.local', isActive: false });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'inactivo@taller.local', password: DEFAULT_PASSWORD });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('USER_INACTIVE');
  });

  it('responde 400 con el detalle de los campos inválidos', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'no-es-correo' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const fields = res.body.error.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['email', 'password']));
  });

  it('responde 400 si el cuerpo no es JSON válido', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": ');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });
});

describe('GET /api/auth/me', () => {
  it('devuelve el perfil del usuario autenticado', async () => {
    const user = await createUser();
    const res = await request(app).get('/api/auth/me').set('Authorization', bearerFor(user));
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(user.id);
  });

  it('responde 401 sin token, con un token malformado o con otro esquema', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set('Authorization', 'Bearer abc.def.ghi')).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set('Authorization', 'Basic YWRtaW46YWRtaW4=')).status).toBe(401);
  });

  it('responde 401 si el usuario fue desactivado después de emitir el token', async () => {
    const user = await createUser({ isActive: false });
    const res = await request(app).get('/api/auth/me').set('Authorization', bearerFor(user));
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/register', () => {
  const newUser = { email: 'nuevo@taller.local', fullName: 'Nuevo Operario', password: 'Operario123' };

  it('permite a un ADMIN registrar usuarios y almacena la contraseña con hash', async () => {
    const admin = await createUser({ role: UserRole.ADMIN });
    const res = await request(app).post('/api/auth/register').set('Authorization', bearerFor(admin)).send(newUser);

    expect(res.status).toBe(201);
    expect(res.headers.location).toBe(`/api/users/${res.body.id}`);
    expect(res.body).toMatchObject({ email: newUser.email, role: 'OPERATOR', isActive: true });

    // El nuevo usuario puede iniciar sesión con su contraseña.
    const login = await request(app).post('/api/auth/login').send({ email: newUser.email, password: newUser.password });
    expect(login.status).toBe(200);
  });

  it('responde 409 si el correo ya existe (sin importar mayúsculas)', async () => {
    const admin = await createUser({ role: UserRole.ADMIN });
    await createUser({ email: 'nuevo@taller.local' });
    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', bearerFor(admin))
      .send({ ...newUser, email: 'NUEVO@taller.local' });
    expect(res.status).toBe(409);
  });

  it('rechaza contraseñas débiles', async () => {
    const admin = await createUser({ role: UserRole.ADMIN });
    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', bearerFor(admin))
      .send({ ...newUser, password: 'debil' });
    expect(res.status).toBe(400);
  });

  it('responde 403 si quien registra no es ADMIN y 401 si no está autenticado', async () => {
    const operator = await createUser({ role: UserRole.OPERATOR });
    expect((await request(app).post('/api/auth/register').set('Authorization', bearerFor(operator)).send(newUser)).status).toBe(403);
    expect((await request(app).post('/api/auth/register').send(newUser)).status).toBe(401);
  });
});

describe('infraestructura', () => {
  it('GET /health informa el estado de la base de datos', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'up' });
  });

  it('responde 404 en formato estándar para rutas inexistentes', async () => {
    const res = await request(app).get('/api/no-existe');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('publica la especificación OpenAPI', async () => {
    const res = await request(app).get('/openapi.json');
    expect(res.status).toBe(200);
    expect(res.body.paths).toHaveProperty('/api/auth/login');
  });
});
