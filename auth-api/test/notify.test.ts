import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { getAlertJobs } from '../src/lib/alerts.js';
import { sendAlertEmail } from '../src/lib/email.js';

vi.mock('../src/db.js', () => ({ pool: { query: vi.fn().mockResolvedValue({ rows: [] }) } }));
vi.mock('../src/lib/alerts.js', () => ({ getAlertJobs: vi.fn() }));
vi.mock('../src/lib/email.js', () => ({ sendAlertEmail: vi.fn(), sendWelcomeEmail: vi.fn() }));

const SECRET = '0123456789abcdef0123456789abcdef'; // mesmo valor do vitest.config.ts

const job = {
  sub_id: 1, user_id: 'u1', doenca: 'dengue', nivel_minimo: 3,
  email: 'ana@example.com', name: 'Ana',
  geocode: 3106200, municipio: 'Belo Horizonte', uf: 'MG', nivel: 4, casos_est: 120, se: 202420,
};

describe('notify routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp({ logger: false });
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejeita sem x-internal-secret', async () => {
    const res = await app.inject({ method: 'POST', url: '/notify/dispatch' });
    expect(res.statusCode).toBe(401);
  });

  it('rejeita secret errado', async () => {
    const res = await app.inject({
      method: 'POST', url: '/notify/dispatch',
      headers: { 'x-internal-secret': 'errado' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('despacha alertas com secret correto', async () => {
    vi.mocked(getAlertJobs).mockResolvedValueOnce([job]);
    vi.mocked(sendAlertEmail).mockResolvedValueOnce(undefined as never);

    const res = await app.inject({
      method: 'POST', url: '/notify/dispatch',
      headers: { 'x-internal-secret': SECRET },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ dispatched: 1, sent: 1, error: 0 });
    expect(sendAlertEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'ana@example.com', municipio: 'Belo Horizonte' }));
  });

  it('contabiliza falhas de envio sem derrubar o dispatch', async () => {
    vi.mocked(getAlertJobs).mockResolvedValueOnce([job, { ...job, sub_id: 2, email: 'bia@example.com' }]);
    vi.mocked(sendAlertEmail)
      .mockResolvedValueOnce(undefined as never)
      .mockRejectedValueOnce(new Error('smtp down'));

    const res = await app.inject({
      method: 'POST', url: '/notify/dispatch',
      headers: { 'x-internal-secret': SECRET },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ dispatched: 2, sent: 1, error: 1 });
  });
});
