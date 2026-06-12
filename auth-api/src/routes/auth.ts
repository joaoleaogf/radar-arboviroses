import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { sendWelcomeEmail } from '../lib/email.js';

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 604800, // 7 dias em segundos
};

export const authRoutes: FastifyPluginAsync = async (fastify) => {

  fastify.post('/register', async (req: FastifyRequest, reply: FastifyReply) => {
    const { name, email, password } = req.body as { name: string; email: string; password: string };
    if (!name || !email || !password) return reply.code(400).send({ error: 'Campos obrigatórios' });
    if (password.length < 8) return reply.code(400).send({ error: 'Senha muito curta (mín. 8 chars)' });

    const exists = await pool.query('SELECT id FROM app_user WHERE email = $1', [email]);
    if (exists.rowCount) return reply.code(409).send({ error: 'E-mail já cadastrado' });

    const hash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      `INSERT INTO app_user (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, email, name, role, email_verified, created_at`,
      [name, email, hash],
    );
    const user = rows[0];
    const token = fastify.jwt.sign({ sub: user.id, role: user.role }, { expiresIn: '7d' });

    if (process.env.RESEND_API_KEY) sendWelcomeEmail(email, name).catch(() => {});

    reply.setCookie('radar_session', token, COOKIE_OPTS);
    return reply.send({ token, user });
  });

  fastify.post('/login', async (req: FastifyRequest, reply: FastifyReply) => {
    const { email, password } = req.body as { email: string; password: string };
    if (!email || !password) return reply.code(400).send({ error: 'Campos obrigatórios' });

    const { rows } = await pool.query(
      'SELECT id, email, name, password_hash, role, email_verified FROM app_user WHERE email = $1',
      [email],
    );
    const user = rows[0];
    if (!user || !user.password_hash) return reply.code(401).send({ error: 'Credenciais inválidas' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return reply.code(401).send({ error: 'Credenciais inválidas' });

    await pool.query('UPDATE app_user SET last_login = now() WHERE id = $1', [user.id]);

    const token = fastify.jwt.sign({ sub: user.id, role: user.role }, { expiresIn: '7d' });

    reply.setCookie('radar_session', token, COOKIE_OPTS);
    return reply.send({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  });

  fastify.post('/logout', async (_req: FastifyRequest, reply: FastifyReply) => {
    reply.clearCookie('radar_session', { path: '/' });
    return reply.send({ ok: true });
  });

  fastify.get('/me', { preHandler: [fastify.authenticate] }, async (req: FastifyRequest) => {
    const payload = req.user as { sub: string };
    const { rows } = await pool.query(
      'SELECT id, email, name, role, email_verified, avatar_url, phone, created_at, last_login FROM app_user WHERE id = $1',
      [payload.sub],
    );
    if (!rows.length) throw { statusCode: 404, message: 'Usuário não encontrado' };
    return rows[0];
  });

  fastify.put('/me', { preHandler: [fastify.authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string };
    const { name, phone } = req.body as { name?: string; phone?: string };
    if (!name && phone === undefined) return reply.code(400).send({ error: 'Nenhum campo para atualizar' });

    const sets: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;
    if (name)            { sets.push(`name=$${idx++}`);  vals.push(name); }
    if (phone !== undefined) { sets.push(`phone=$${idx++}`); vals.push(phone || null); }
    vals.push(payload.sub);

    const { rows } = await pool.query(
      `UPDATE app_user SET ${sets.join(',')} WHERE id=$${idx} RETURNING id,email,name,role,phone,avatar_url,email_verified,created_at,last_login`,
      vals,
    );
    return rows[0];
  });
};
