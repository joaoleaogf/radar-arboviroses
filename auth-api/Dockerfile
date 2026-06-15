FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY tsconfig.json ./

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "--import", "tsx/esm", "src/index.ts"]
