import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { pool } from '../db.js';
import { getAlertJobs } from '../lib/alerts.js';

function requireAdmin(req: FastifyRequest, reply: FastifyReply, done: () => void) {
  const payload = req.user as { role: string };
  if (payload.role !== 'admin') {
    reply.code(403).send({ error: 'Acesso restrito a administradores' });
    return;
  }
  done();
}

const roleSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', format: 'uuid' } },
  },
  body: {
    type: 'object',
    required: ['role'],
    additionalProperties: false,
    properties: { role: { type: 'string', enum: ['user', 'admin'] } },
  },
};

export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  const guards = [fastify.authenticate, requireAdmin];

  // GET /admin/users
  fastify.get('/users', { preHandler: guards }, async () => {
    const { rows } = await pool.query(
      `SELECT id, email, name, role, email_verified, created_at, last_login,
              (SELECT count(*) FROM user_alert_subscription s WHERE s.user_id = u.id) AS subscriptions
       FROM app_user u
       ORDER BY created_at DESC`,
    );
    return rows;
  });

  // PATCH /admin/users/:id/role
  fastify.patch<{ Params: { id: string }; Body: { role: 'user' | 'admin' } }>(
    '/users/:id/role',
    { preHandler: guards, schema: roleSchema },
    async (req, reply) => {
      const { id } = req.params;
      const { role } = req.body;
      const { rows } = await pool.query(
        'UPDATE app_user SET role = $1 WHERE id = $2 RETURNING id, email, name, role',
        [role, id],
      );
      if (!rows.length) return reply.code(404).send({ error: 'Usuário não encontrado' });
      return rows[0];
    },
  );

  // GET /admin/etl — histórico de execuções do ETL
  fastify.get('/etl', { preHandler: guards }, async () => {
    const { rows } = await pool.query(
      `SELECT id, workflow, started, finished, status, registros, erro
       FROM etl_run
       ORDER BY started DESC
       LIMIT 50`,
    );
    return rows;
  });

  // GET /admin/stats — resumo geral da plataforma
  fastify.get('/stats', { preHandler: guards }, async () => {
    const [users, munis, casos, alertas] = await Promise.all([
      pool.query('SELECT count(*) FROM app_user'),
      pool.query('SELECT count(*) FROM municipio'),
      pool.query('SELECT count(*) FROM caso_semana'),
      pool.query('SELECT count(*) FROM user_alert_subscription WHERE ativo = true'),
    ]);
    return {
      usuarios:     Number(users.rows[0].count),
      municipios:   Number(munis.rows[0].count),
      casos:        Number(casos.rows[0].count),
      assinaturas:  Number(alertas.rows[0].count),
    };
  });

  // POST /admin/notify-test — prévia das notificações que seriam disparadas
  fastify.post('/notify-test', { preHandler: guards }, async (_req, reply) => {
    const jobs = await getAlertJobs();
    return reply.send({ jobs: jobs.length, preview: jobs.slice(0, 3) });
  });
};
