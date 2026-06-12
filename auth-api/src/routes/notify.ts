import type { FastifyPluginAsync } from 'fastify';
import { pool } from '../db.js';
import { sendAlertEmail } from '../lib/email.js';

// Chamado pelo n8n (WF5) após cada ETL bem-sucedido
export const notifyRoutes: FastifyPluginAsync = async (fastify) => {

  fastify.post('/dispatch', async (req, reply) => {
    // Verifica secret interno
    const auth = req.headers['x-internal-secret'];
    if (auth !== process.env.INTERNAL_SECRET) return reply.code(401).send({ error: 'Não autorizado' });

    const { rows: jobs } = await pool.query(`
      SELECT DISTINCT ON (s.id)
             s.id AS sub_id, s.user_id, s.doenca, s.nivel_minimo,
             u.email, u.name,
             sa.geocode, sa.nome AS municipio, sa.uf, sa.nivel, sa.casos_est, sa.se
      FROM user_alert_subscription s
      JOIN app_user u ON u.id = s.user_id
      JOIN situacao_atual sa
        ON sa.doenca = s.doenca
        AND sa.nivel >= s.nivel_minimo
        AND (s.geocode IS NULL OR s.geocode = sa.geocode)
        AND (s.uf IS NULL OR s.uf = sa.uf)
        AND (s.regiao IS NULL OR s.regiao = sa.regiao)
      WHERE s.ativo = true AND s.canal = 'email'
      ORDER BY s.id, sa.nivel DESC
    `);

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

    const sent  = results.filter(r => r.status === 'fulfilled').length;
    const error = results.filter(r => r.status === 'rejected').length;
    return { dispatched: jobs.length, sent, error };
  });
};
