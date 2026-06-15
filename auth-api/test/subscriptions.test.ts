import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { pool } from '../src/db.js';

vi.mock('../src/db.js', () => ({ pool: { query: vi.fn() } }));

const query = vi.mocked(pool.query);

describe('subscription routes', () => {
  let app: FastifyInstance;
  let token: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp({ logger: false });
    token = app.jwt.sign({ sub: 'u1', role: 'user' });
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST sem autenticação retorna 401', async () => {
    const res = await app.inject({
      method: 'POST', url: '/subscriptions',
      payload: { doenca: 'dengue' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST com nivel_minimo fora da faixa retorna 400', async () => {
    const res = await app.inject({
      method: 'POST', url: '/subscriptions',
      headers: { authorization: `Bearer ${token}` },
      payload: { doenca: 'dengue', nivel_minimo: 9 },
    });
    expect(res.statusCode).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  it('POST válido aplica defaults e cria a assinatura', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 1, doenca: 'dengue', nivel_minimo: 3 }] } as never);
    const res = await app.inject({
      method: 'POST', url: '/subscriptions',
      headers: { authorization: `Bearer ${token}` },
      payload: { geocode: 3106200, doenca: 'dengue', nivel_minimo: 3, canal: 'email', frequencia: 'imediato' },
    });
    expect(res.statusCode).toBe(201);
    expect(query).toHaveBeenCalledWith(
      expect.any(String),
      ['u1', 3106200, null, null, 'dengue', 3, 'email', 'imediato', null],
    );
  });
});
