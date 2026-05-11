/**
 * Integration tests para /api/v1/auth
 *
 * Cubre: login OK, lockout (5 fallos → 423), usuario desactivado (403),
 * register con nombre, rol inválido, reset password, change password.
 *
 * Requiere una BD PostgreSQL activa con la migración 015_auth_final.sql aplicada.
 * La limpieza entre tests la gestiona el hook afterEach de ../setup.ts
 * (borra usuarios que no son admin@sigah.gov.co).
 */
import '../setup';

import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env.test') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

import app from '../../src/app';
import { pool } from '../../src/config/database';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-do-not-use-in-production';

function makeAdminToken(id = 1): string {
  return jwt.sign(
    { id, email: 'admin@sigah.gov.co', role: 'ADMIN', name: 'Administrador SIGAH' },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
}

const adminToken = makeAdminToken();

// ---------------------------------------------------------------------------
// Helpers de BD directa para configurar estado previo a los tests
// ---------------------------------------------------------------------------

async function createTestUser(overrides: {
  email?: string;
  password?: string;
  role?: string;
  name?: string;
  is_active?: boolean;
  failed_login_attempts?: number;
  locked_until?: string | null;
}): Promise<number> {
  const {
    email = 'test@sigah.test',
    password = 'TestPass123!',
    role = 'FUNCIONARIO_CONTROL',
    name = 'Test User',
    is_active = true,
    failed_login_attempts = 0,
    locked_until = null,
  } = overrides;

  const password_hash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO users (email, password_hash, role, name, is_active, failed_login_attempts, locked_until, password_must_change)
     VALUES ($1, $2, $3::role, $4, $5, $6, $7, false)
     RETURNING id`,
    [email, password_hash, role, name, is_active, failed_login_attempts, locked_until],
  );
  return rows[0].id;
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

describe('POST /api/v1/auth/login', () => {
  it('devuelve 200 y token JWT con name cuando las credenciales son correctas', async () => {
    await createTestUser({ email: 'valid@sigah.test', password: 'GoodPass1!' });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'valid@sigah.test', password: 'GoodPass1!' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();

    const decoded = jwt.verify(res.body.data.token, JWT_SECRET) as {
      id: number;
      email: string;
      role: string;
      name: string;
    };
    expect(decoded.name).toBeDefined();
    expect(decoded.email).toBe('valid@sigah.test');
  });

  it('devuelve 401 cuando la contraseña es incorrecta', async () => {
    await createTestUser({ email: 'fail@sigah.test', password: 'RealPass123!' });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'fail@sigah.test', password: 'WrongPass' });

    expect(res.status).toBe(401);
  });

  it('devuelve 401 cuando el email no existe', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'noexiste@sigah.test', password: 'cualquier' });

    expect(res.status).toBe(401);
  });

  it('devuelve 403 cuando el usuario está desactivado (is_active=false)', async () => {
    await createTestUser({
      email: 'inactive@sigah.test',
      password: 'TestPass1!',
      is_active: false,
    });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'inactive@sigah.test', password: 'TestPass1!' });

    expect(res.status).toBe(403);
  });

  it('bloquea la cuenta tras 5 fallos consecutivos y retorna 423', async () => {
    const email = 'lockme@sigah.test';
    const password = 'RealPass123!';
    await createTestUser({ email, password });

    // 5 intentos fallidos
    for (let i = 0; i < 5; i++) {
      const r = await request(app)
        .post('/api/v1/auth/login')
        .send({ email, password: 'wrong' });
      // Los primeros 4 son 401; el 5to debería ser 423 (el SP bloquea al llegar al límite)
      if (i < 4) {
        expect(r.status).toBe(401);
      }
    }

    // El 5to fallo bloquea; el siguiente intento (incluso con contraseña correcta)
    // debería retornar 423.
    const lockedRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password });

    expect(lockedRes.status).toBe(423);
  });
});

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------

describe('POST /api/v1/auth/register', () => {
  it('devuelve 201 cuando el ADMIN crea un usuario con name', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'nuevo@sigah.test',
        name: 'Usuario Nuevo',
        password: 'Seguro123!',
        role: 'CENSADOR',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Usuario Nuevo');
    expect(res.body.data.password_must_change).toBe(true);
  });

  it('devuelve 422 cuando el rol no pertenece al enum de 6 valores', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'bad@sigah.test',
        name: 'Bad Role',
        password: 'Seguro123!',
        role: 'VIEWER', // rol viejo, ya no válido
      });

    expect(res.status).toBe(422);
  });

  it('devuelve 422 cuando el rol es COORDINATOR (rol viejo)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'coord@sigah.test',
        name: 'Old Coord',
        password: 'Seguro123!',
        role: 'COORDINATOR',
      });

    expect(res.status).toBe(422);
  });

  it('devuelve 422 cuando la contraseña tiene menos de 8 caracteres', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'short@sigah.test',
        name: 'Short Pass',
        password: '1234567', // 7 chars
        role: 'CENSADOR',
      });

    expect(res.status).toBe(422);
  });

  it('devuelve 422 cuando falta name', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'noname@sigah.test',
        password: 'Seguro123!',
        role: 'CENSADOR',
      });

    expect(res.status).toBe(422);
  });

  it('devuelve 409 cuando el email ya está registrado', async () => {
    await createTestUser({ email: 'dup@sigah.test' });

    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'dup@sigah.test',
        name: 'Duplicado',
        password: 'Seguro123!',
        role: 'CENSADOR',
      });

    expect(res.status).toBe(409);
  });

  it('devuelve 403 cuando un no-ADMIN intenta registrar', async () => {
    const censadorToken = jwt.sign(
      { id: 9999, email: 'cens@sigah.test', role: 'CENSADOR', name: 'Censador' },
      JWT_SECRET,
      { expiresIn: '1h' },
    );

    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('Authorization', `Bearer ${censadorToken}`)
      .send({
        email: 'otro@sigah.test',
        name: 'Otro',
        password: 'Seguro123!',
        role: 'CENSADOR',
      });

    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Change password
// ---------------------------------------------------------------------------

describe('PUT /api/v1/auth/change-password', () => {
  it('cambia la contraseña y pone password_must_change=false', async () => {
    const userId = await createTestUser({
      email: 'chpwd@sigah.test',
      password: 'OldPass1!',
    });

    const userToken = jwt.sign(
      { id: userId, email: 'chpwd@sigah.test', role: 'FUNCIONARIO_CONTROL', name: 'Test' },
      JWT_SECRET,
      { expiresIn: '1h' },
    );

    const res = await request(app)
      .put('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ oldPassword: 'OldPass1!', newPassword: 'NewPass1234!' });

    expect(res.status).toBe(200);

    // Verificar en BD que password_must_change es false
    const { rows } = await pool.query<{ password_must_change: boolean }>(
      'SELECT password_must_change FROM users WHERE id = $1',
      [userId],
    );
    expect(rows[0].password_must_change).toBe(false);
  });

  it('devuelve 401 cuando el password viejo es incorrecto', async () => {
    const userId = await createTestUser({
      email: 'badchpwd@sigah.test',
      password: 'OldPass1!',
    });

    const userToken = jwt.sign(
      { id: userId, email: 'badchpwd@sigah.test', role: 'FUNCIONARIO_CONTROL', name: 'Test' },
      JWT_SECRET,
      { expiresIn: '1h' },
    );

    const res = await request(app)
      .put('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ oldPassword: 'Wrong!', newPassword: 'NewPass1234!' });

    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Reset password (ADMIN)
// ---------------------------------------------------------------------------

describe('POST /api/v1/auth/reset-password/:userId', () => {
  it('genera una contraseña temporal y retorna password_must_change=true', async () => {
    const userId = await createTestUser({ email: 'resetme@sigah.test' });

    const res = await request(app)
      .post(`/api/v1/auth/reset-password/${userId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.temporary_password).toBeDefined();
    expect(typeof res.body.data.temporary_password).toBe('string');
    expect(res.body.data.temporary_password.length).toBeGreaterThan(0);

    // Verificar en BD que password_must_change=true
    const { rows } = await pool.query<{ password_must_change: boolean }>(
      'SELECT password_must_change FROM users WHERE id = $1',
      [userId],
    );
    expect(rows[0].password_must_change).toBe(true);
  });

  it('devuelve 404 si el usuario no existe', async () => {
    const res = await request(app)
      .post('/api/v1/auth/reset-password/99999')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  it('devuelve 403 si un no-ADMIN intenta resetear contraseña', async () => {
    const userId = await createTestUser({ email: 'victim@sigah.test' });

    const censadorToken = jwt.sign(
      { id: 9999, email: 'cens@sigah.test', role: 'CENSADOR', name: 'Censador' },
      JWT_SECRET,
      { expiresIn: '1h' },
    );

    const res = await request(app)
      .post(`/api/v1/auth/reset-password/${userId}`)
      .set('Authorization', `Bearer ${censadorToken}`);

    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Set active (ADMIN)
// ---------------------------------------------------------------------------

describe('PUT /api/v1/auth/users/:id', () => {
  it('desactiva un usuario existente', async () => {
    const userId = await createTestUser({ email: 'deactivate@sigah.test' });

    const res = await request(app)
      .put(`/api/v1/auth/users/${userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ is_active: false });

    expect(res.status).toBe(200);
    expect(res.body.data.is_active).toBe(false);
  });

  it('activa un usuario previamente desactivado', async () => {
    const userId = await createTestUser({
      email: 'reactivate@sigah.test',
      is_active: false,
    });

    const res = await request(app)
      .put(`/api/v1/auth/users/${userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ is_active: true });

    expect(res.status).toBe(200);
    expect(res.body.data.is_active).toBe(true);
  });

  it('devuelve 404 si el usuario no existe', async () => {
    const res = await request(app)
      .put('/api/v1/auth/users/99999')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ is_active: false });

    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// List users (ADMIN)
// ---------------------------------------------------------------------------

describe('GET /api/v1/auth/users', () => {
  it('devuelve la lista paginada de usuarios', async () => {
    await createTestUser({ email: 'list1@sigah.test', role: 'CENSADOR' });
    await createTestUser({ email: 'list2@sigah.test', role: 'OPERADOR_ENTREGAS' });

    const res = await request(app)
      .get('/api/v1/auth/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.total).toBeGreaterThanOrEqual(2);
    // No debe exponer password_hash
    expect(res.body.data[0].password_hash).toBeUndefined();
  });

  it('filtra por role', async () => {
    await createTestUser({ email: 'cens@sigah.test', role: 'CENSADOR' });
    await createTestUser({ email: 'oper@sigah.test', role: 'OPERADOR_ENTREGAS' });

    const res = await request(app)
      .get('/api/v1/auth/users?role=CENSADOR')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.every((u: { role: string }) => u.role === 'CENSADOR')).toBe(true);
  });

  it('devuelve 403 si no es ADMIN', async () => {
    const nonAdminToken = jwt.sign(
      { id: 9999, email: 'x@sigah.test', role: 'COORDINADOR_LOGISTICA', name: 'X' },
      JWT_SECRET,
      { expiresIn: '1h' },
    );

    const res = await request(app)
      .get('/api/v1/auth/users')
      .set('Authorization', `Bearer ${nonAdminToken}`);

    expect(res.status).toBe(403);
  });
});
