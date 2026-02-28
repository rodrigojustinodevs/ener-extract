# ============================================
# Stage 1: Dependencies (inclui devDependencies para o build)
# ============================================
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Copiar apenas arquivos de lock e de definição de dependências
COPY pnpm-lock.yaml pnpm-workspace.yaml* package.json ./

# Instalar TODAS as dependências (devDependencies necessárias para nest build)
ENV NODE_ENV=development
RUN pnpm install --frozen-lockfile

# ============================================
# Stage 2: Builder (Prisma generate + build NestJS)
# ============================================
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Garantir que devDependencies estão disponíveis para o build
ENV NODE_ENV=development

# Gerar cliente Prisma
RUN pnpm prisma generate

# Build da aplicação NestJS (gera dist/)
RUN pnpm run build

# Falhar se o entrypoint não foi gerado (evita imagem quebrada)
RUN test -f /app/dist/src/main.js || (echo "Build failed: dist/src/main.js not found" && exit 1)

# ============================================
# Stage 3: Production
# ============================================
FROM node:22-alpine AS runner
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

ENV NODE_ENV=production

# Copiar dependências do stage deps (produção)
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./
COPY --from=deps /app/pnpm-lock.yaml ./

# Copiar schema Prisma e migrations (para migrate deploy no runtime, se necessário)
COPY prisma ./prisma

# Copiar build gerado (mesmo path do script start:prod do package.json)
COPY --from=builder /app/dist ./dist

EXPOSE 3000

# Migrations podem ser rodadas via: docker compose exec app pnpm prisma migrate deploy
CMD ["node", "dist/src/main.js"]
