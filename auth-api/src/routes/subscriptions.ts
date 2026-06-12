import type { FastifyPluginAsync } from 'fastify';
import { pool } from '../db.js';

interface CreateSubBody {
  geocode?: number;
  uf?: string;
  regiao?: string;
  doenca: string;
  nivel_minimo: number;
  canal: string;
  frequencia: string;
  rt_minimo?: number;
}

const createSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    properties: {
      geocode:      { type: 'integer', minimum: 1100000, maximum: 5399999 },
      uf:           { type: 'string', pattern: '^[A-Z]{2}$' },
      regiao:       { type: 'string', maxLength: 40 },
      doenca:       { type: 'string', enum: ['dengue', 'chikungunya'], default: 'dengue' },
      nivel_minimo: { type: 'integer', minimum: 1, maximum: 4, default: 3 },
      canal:        { type: 'string', enum: ['email'], default: 'email' },
      frequencia:   { type: 'string', enum: ['imediato', 'diario', 'semanal'], default: 'imediato' },
      rt_minimo:    { type: 'number', minimum: 0 },
    },
  },
};

const idParamsSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', pattern: '^[0-9]+$' } },
  },
};

export const subscriptionRoutes: FastifyPluginAsync = async (fastify) => {

  fastify.get('/', { preHandler: [fastify.authenticate] }, async (req) => {
    const { sub } = req.user as { sub: string };
    const { rows } = await pool.query(
      `SELECT s.id, s.geocode, s.uf, s.regiao, s.doenca, s.nivel_minimo,
              s.canal, s.frequencia, s.rt_minimo, s.ativo,
              m.nome AS municipio_nome
       FROM user_alert_subscription s
       LEFT JOIN municipio m ON m.geocode = s.geocode
       WHERE s.user_id = $1
       ORDER BY s.created_at DESC`,
      [sub],
    );
    return rows;
  });

  fastify.post<{ Body: CreateSubBody }>('/', { preHandler: [fastify.authenticate], schema: createSchema }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const body = req.body;
    const { rows } = await pool.query(
      `INSERT INTO user_alert_subscription
         (user_id, geocode, uf, regiao, doenca, nivel_minimo, canal, frequencia, rt_minimo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        sub,
        body.geocode ?? null,
        body.uf ?? null,
        body.regiao ?? null,
        body.doenca,
        body.nivel_minimo,
        body.canal,
        body.frequencia,
        body.rt_minimo ?? null,
      ],
    );
    return reply.code(201).send(rows[0]);
  });

  fastify.delete<{ Params: { id: string } }>('/:id', { preHandler: [fastify.authenticate], schema: idParamsSchema }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM user_alert_subscription WHERE id = $1 AND user_id = $2',
      [id, sub],
    );
    if (!result.rowCount) return reply.code(404).send({ error: 'Assinatura não encontrada' });
    return reply.code(204).send();
  });

  fastify.patch<{ Params: { id: string } }>('/:id/toggle', { preHandler: [fastify.authenticate], schema: idParamsSchema }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { id } = req.params;
    const { rows } = await pool.query(
      `UPDATE user_alert_subscription SET ativo = NOT ativo
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, sub],
    );
    if (!rows.length) return reply.code(404).send({ error: 'Assinatura não encontrada' });
    return rows[0];
  });
};
