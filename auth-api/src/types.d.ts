import type { FastifyReply, FastifyRequest } from 'fastify';
import type { OAuth2Namespace } from '@fastify/oauth2';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    googleOAuth2?: OAuth2Namespace;
  }
}
