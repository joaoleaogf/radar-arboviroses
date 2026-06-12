import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { pool } from '../src/db.js';

vi.mock('../src/db.js', () => ({ pool: { query: vi.fn() } }));

const query = vi.mocked(pool.query);

describe('geo routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    query.mockResolvedValue({ rows: [] } as never);
    app = await buildApp({ logger: false });
  });

  afterEach(async () => {
    await app.close();
  });

  it('/geo/municipios aplica defaults dengue/*/*', async () => {
    const res = await app.inject({ method: 'GET', url: '/geo/municipios' });
    expect(res.statusCode).toBe(200);
    expect(query).toHaveBeenCalledWith(expect.any(String), ['dengue', '*', '*']);
  });

  it('/geo/municipios aceita filtros válidos', async () => {
    const res = await app.inject({ method: 'GET', url: '/geo/municipios?doenca=chikungunya&uf=MG' });
    expect(res.statusCode).toBe(200);
    expect(query).toHaveBeenCalledWith(expect.any(String), ['chikungunya', 'MG', '*']);
  });

  it('/geo/municipios rejeita uf inválida com 400', async () => {
    const res = await app.inject({ method: 'GET', url: '/geo/municipios?uf=xx' });
    expect(res.statusCode).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  it('/geo/municipios rejeita doenca desconhecida com 400', async () => {
    const res = await app.inject({ method: 'GET', url: '/geo/municipios?doenca=zika' });
    expect(res.statusCode).toBe(400);
  });

  it('/geo/serie exige geocode', async () => {
    const res = await app.inject({ method: 'GET', url: '/geo/serie' });
    expect(res.statusCode).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  it('/geo/serie rejeita geocode malformado', async () => {
    const res = await app.inject({ method: 'GET', url: '/geo/serie?geocode=abc' });
    expect(res.statusCode).toBe(400);
  });

  it('/geo/serie retorna 200 com geocode válido', async () => {
    const res = await app.inject({ method: 'GET', url: '/geo/serie?geocode=3106200' });
    expect(res.statusCode).toBe(200);
    expect(query).toHaveBeenCalledWith(expect.any(String), ['3106200', 'dengue']);
  });
});
