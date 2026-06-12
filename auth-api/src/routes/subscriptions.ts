import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { pool } from '../db.js';

export const subscriptionRoutes: FastifyPluginAsync = async (fastify) => {

  fastify.get('/', { preHandler: [fastify.authenticate] }, async (req: FastifyRequest) => {
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

  fastify.post('/', { preHandler: [fastify.authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { sub } = req.user as { sub: string };
    const body = req.body as {
      geocode?: number;
      uf?: string;
      regiao?: string;
      doenca?: string;
      nivel_minimo?: number;
      canal?: string;
      frequencia?: string;
      rt_minimo?: number;
    };
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
        body.doenca ?? 'dengue',
        body.nivel_minimo ?? 3,
        body.canal ?? 'email',
        body.frequencia ?? 'imediato',
        body.rt_minimo ?? null,
      ],
    );
    return reply.code(201).send(rows[0]);
  });

  fastify.delete('/:id', { preHandler: [fastify.authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { sub } = req.user as { sub: string };
    const { id } = req.params as { id: string };
    const result = await pool.query(
      'DELETE FROM user_alert_subscription WHERE id = $1 AND user_id = $2',
      [id, sub],
    );
    if (!result.rowCount) return reply.code(404).send({ error: 'Assinatura não encontrada' });
    return reply.code(204).send();
  });

  fastify.patch('/:id/toggle', { preHandler: [fastify.authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { sub } = req.user as { sub: string };
    const { id } = req.params as { id: string };
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
