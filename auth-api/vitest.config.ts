import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret-test-secret-test-secret',
      INTERNAL_SECRET: '0123456789abcdef0123456789abcdef',
      DATABASE_URL: 'postgres://test:test@localhost:5432/test',
      CORS_ORIGIN: 'http://localhost:4200',
      RESEND_API_KEY: '',
      GOOGLE_CLIENT_ID: '',
      GOOGLE_CLIENT_SECRET: '',
    },
  },
});
