import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';
import { pool } from './db.js';
import { authRoutes } from './routes/auth.js';
import { subscriptionRoutes } from './routes/subscriptions.js';
import { adminRoutes } from './routes/admin.js';
import { notifyRoutes } from './routes/notify.js';
import { geoRoutes } from './routes/geo.js';

const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });

await app.register(cors, {
  origin: (process.env.CORS_ORIGIN ?? 'http://localhost:4200').split(','),
  credentials: true,
});

await app.register(cookie);

await app.register(jwt, { secret: process.env.JWT_SECRET! });

// Aceita Bearer header OU cookie httpOnly radar_session
app.decorate('authenticate', async (req: any, reply: any) => {
  try {
    const authHeader = req.headers['authorization'];
    if (authHeader?.startsWith('Bearer ')) {
      await req.jwtVerify();
    } else {
      const cookieToken = (req.cookies as Record<string, string | undefined>)?.radar_session;
      if (!cookieToken) return reply.code(401).send({ error: 'Não autenticado' });
      const payload = app.jwt.verify(cookieToken);
      req.user = payload;
    }
  } catch {
    return reply.code(401).send({ error: 'Token inválido ou expirado' });
  }
});

// Google OAuth2 — skip se credenciais ausentes
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  const oauth2 = await import('@fastify/oauth2');
  await app.register(oauth2.default, {
    name: 'googleOAuth2',
    scope: ['profile', 'email'],
    credentials: {
      client: { id: process.env.GOOGLE_CLIENT_ID, secret: process.env.GOOGLE_CLIENT_SECRET },
      auth: (oauth2.default as any).GOOGLE_CONFIGURATION,
    },
    startRedirectPath: '/auth/google',
    callbackUri: `${process.env.API_BASE_URL ?? 'http://localhost:3001'}/auth/google/callback`,
  });

  app.get('/auth/google/callback', async (req: any, reply: any) => {
    try {
      const token = await (app as any).googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(req);
      const info = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${token.token.access_token}` },
      }).then(r => r.json()) as { id: string; email: string; name: string; picture: string };

      let { rows } = await pool.query('SELECT * FROM app_user WHERE google_id=$1 OR email=$2', [info.id, info.email]);
      let user = rows[0];
      if (!user) {
        const res = await pool.query(
          `INSERT INTO app_user (email, name, google_id, avatar_url, email_verified) VALUES ($1,$2,$3,$4,true) RETURNING *`,
          [info.email, info.name, info.id, info.picture],
        );
        user = res.rows[0];
      } else if (!user.google_id) {
        await pool.query('UPDATE app_user SET google_id=$1, avatar_url=$2 WHERE id=$3', [info.id, info.picture, user.id]);
      }
      await pool.query('UPDATE app_user SET last_login=now() WHERE id=$1', [user.id]);
      const jwtToken = app.jwt.sign({ sub: user.id, role: user.role }, { expiresIn: '7d' });
      reply.setCookie('radar_session', jwtToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 604800 });
      reply.redirect(`${process.env.FRONTEND_URL ?? 'http://localhost:4200'}/auth/callback?token=${jwtToken}`);
    } catch {
      reply.redirect(`${process.env.FRONTEND_URL ?? 'http://localhost:4200'}/auth/login?error=oauth`);
    }
  });
}

await app.register(authRoutes,         { prefix: '/auth' });
await app.register(subscriptionRoutes, { prefix: '/subscriptions' });
await app.register(adminRoutes,        { prefix: '/admin' });
await app.register(notifyRoutes,       { prefix: '/notify' });
await app.register(geoRoutes,          { prefix: '/geo' });

app.get('/health', async () => {
  const { rows } = await pool.query('SELECT 1');
  return { status: 'ok', db: !!rows.length };
});

try {
  await app.listen({ port: 3001, host: '0.0.0.0' });
  console.log('auth-api rodando em :3001');
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
