import { timingSafeEqual } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import { pool } from '../db.js';
import { sendAlertEmail } from '../lib/email.js';
import { getAlertJobs } from '../lib/alerts.js';

function validSecret(header: unknown): boolean {
  const secret = process.env.INTERNAL_SECRET ?? '';
  if (typeof header !== 'string' || !secret) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Chamado pelo n8n (WF5) após cada ETL bem-sucedido
export const notifyRoutes: FastifyPluginAsync = async (fastify) => {

  fastify.post('/dispatch', async (req, reply) => {
    if (!validSecret(req.headers['x-internal-secret'])) {
      return reply.code(401).send({ error: 'Não autorizado' });
    }

    const jobs = await getAlertJobs();

    const results = await Promise.allSettled(
      jobs.map(async (j) => {
        await sendAlertEmail({
          to:        j.email,
          nome:      j.name,
          municipio: j.municipio,
          uf:        j.uf,
          doenca:    j.doenca,
          nivel:     j.nivel,
          casosEst:  j.casos_est,
          se:        j.se,
        });
        await pool.query(
          `INSERT INTO notification_log (user_id, geocode, doenca, nivel, canal, assunto, status)
           VALUES ($1,$2,$3,$4,'email',$5,'sent')`,
          [j.user_id, j.geocode, j.doenca, j.nivel, `Alerta ${j.municipio}`],
        );
      }),
    );

    for (const r of results) {
      if (r.status === 'rejected') req.log.error({ err: r.reason }, 'falha no envio de alerta');
    }

    const sent  = results.filter(r => r.status === 'fulfilled').length;
    const error = results.filter(r => r.status === 'rejected').length;
    return { dispatched: jobs.length, sent, error };
  });
};
