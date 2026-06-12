import { buildApp } from './app.js';

// Fail-fast: sem estes valores a API não deve subir
for (const key of ['DATABASE_URL', 'JWT_SECRET', 'INTERNAL_SECRET'] as const) {
  if (!process.env[key]) {
    console.error(`Variável de ambiente obrigatória ausente: ${key}`);
    process.exit(1);
  }
}

const app = await buildApp();

try {
  await app.listen({ port: 3001, host: '0.0.0.0' });
  app.log.info('auth-api rodando em :3001');
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
