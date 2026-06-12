import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { pool } from '../src/db.js';

vi.mock('../src/db.js', () => ({ pool: { query: vi.fn() } }));

const query = vi.mocked(pool.query);

const validRegister = { name: 'Ana', email: 'ana@example.com', password: 'senha-forte-123' };

describe('auth routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp({ logger: false });
  });

  afterEach(async () => {
    await app.close();
  });

  it('registra usuário novo com cookie e token', async () => {
    query
      .mockResolvedValueOnce({ rowCount: 0, rows: [] } as never)
      .mockResolvedValueOnce({ rows: [{ id: 'u1', email: validRegister.email, name: validRegister.name, role: 'user' }] } as never);

    const res = await app.inject({ method: 'POST', url: '/auth/register', payload: validRegister });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.token).toBeTruthy();
    expect(body.user.email).toBe(validRegister.email);
    expect(res.cookies.find(c => c.name === 'radar_session')).toBeTruthy();
  });

  it('rejeita e-mail inválido com 400', async () => {
    const res = await app.inject({
      method: 'POST', url: '/auth/register',
      payload: { ...validRegister, email: 'nao-eh-email' },
    });
    expect(res.statusCode).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  it('rejeita senha curta com 400', async () => {
    const res = await app.inject({
      method: 'POST', url: '/auth/register',
      payload: { ...validRegister, password: 'curta' },
    });
    expect(res.statusCode).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  it('rejeita e-mail duplicado com 409', async () => {
    query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'u1' }] } as never);
    const res = await app.inject({ method: 'POST', url: '/auth/register', payload: validRegister });
    expect(res.statusCode).toBe(409);
  });

  it('faz login com credenciais válidas', async () => {
    const hash = await bcrypt.hash('senha-forte-123', 4);
    query
      .mockResolvedValueOnce({ rows: [{ id: 'u1', email: 'ana@example.com', name: 'Ana', password_hash: hash, role: 'user' }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never); // UPDATE last_login

    const res = await app.inject({
      method: 'POST', url: '/auth/login',
      payload: { email: 'ana@example.com', password: 'senha-forte-123' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().token).toBeTruthy();
    expect(res.cookies.find(c => c.name === 'radar_session')).toBeTruthy();
  });

  it('retorna 401 para credenciais inválidas', async () => {
    query.mockResolvedValueOnce({ rows: [] } as never);
    const res = await app.inject({
      method: 'POST', url: '/auth/login',
      payload: { email: 'ana@example.com', password: 'senha-errada-123' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('aplica rate limit no login após 5 tentativas', async () => {
    query.mockResolvedValue({ rows: [] } as never);
    const payload = { email: 'ana@example.com', password: 'senha-errada-123' };
    for (let i = 0; i < 5; i++) {
      const res = await app.inject({ method: 'POST', url: '/auth/login', payload });
      expect(res.statusCode).toBe(401);
    }
    const res = await app.inject({ method: 'POST', url: '/auth/login', payload });
    expect(res.statusCode).toBe(429);
  });

  it('/auth/me sem token retorna 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/auth/me' });
    expect(res.statusCode).toBe(401);
  });

  it('/auth/me com Bearer válido retorna o usuário', async () => {
    const token = app.jwt.sign({ sub: 'u1', role: 'user' });
    query.mockResolvedValueOnce({ rows: [{ id: 'u1', email: 'ana@example.com', name: 'Ana', role: 'user' }] } as never);

    const res = await app.inject({
      method: 'GET', url: '/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe('u1');
  });
});
