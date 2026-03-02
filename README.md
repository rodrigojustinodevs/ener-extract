# ener-extract

Backend NestJS (Prisma + MySQL) para extração e processamento de faturas de energia em PDF.

---

## Passo a passo: rodar o projeto com Docker

### Pré-requisitos

- [Docker](https://docs.docker.com/get-docker/) instalado
- [Docker Compose](https://docs.docker.com/compose/install/) (v2+)

---

### Passo 1 — Configurar variáveis de ambiente

Na raiz do projeto:

```bash
cp .env.example .env
```

Edite o `.env` se precisar. O essencial para Docker:

- `MYSQL_ROOT_PASSWORD`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_PORT` — usados pelo MySQL no Compose
- `APP_PORT` — porta em que a API sobe (ex.: 3001)
- `DATABASE_URL` — para rodar migrate **no host** use `localhost` e a porta do MySQL (ex.: 3309). Dentro do container a app usa `mysql:3306` automaticamente
- JWT: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, etc.
- (Opcional) `INVOICE_EXTRACTOR_MODE=pdf` ou `llm`; se `llm`, configure `GEMINI_API_KEY`

---

### Passo 2 — Build da imagem

```bash
docker compose build
```

---

### Passo 3 — Subir os serviços

```bash
docker compose up -d
```

- **MySQL** sobe primeiro (healthcheck) na porta configurada (ex.: 3309 no host).
- **App** sobe depois e fica disponível em `http://localhost:3001` (ou na porta definida em `APP_PORT`).

---

### Passo 4 — Rodar as migrations

Com os containers em execução:

```bash
docker compose exec app pnpm prisma migrate deploy
```

---

### Passo 5 — (Opcional) Criar usuário João

Chame o endpoint de registro da API (com a API já no ar):

```bash
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"João Silva","email":"joao@example.com","password":"senha123"}'
```

A resposta traz os tokens. Use o `accessToken` no header `Authorization: Bearer <token>` para acessar rotas protegidas (ex.: upload de faturas).

---

### Comandos úteis

| Ação              | Comando                                              |
|-------------------|------------------------------------------------------|
| Subir em background | `docker compose up -d`                             |
| Parar tudo       | `docker compose down`                               |
| Ver logs         | `docker compose logs -f`                             |
| Logs só da app   | `docker compose logs -f app`                         |
| Rebuild e subir  | `docker compose up -d --build`                       |
| Migrations       | `docker compose exec app pnpm prisma migrate deploy` |
| Shell no container | `docker compose exec app sh`                        |

---

### Testar a API

```bash
curl http://localhost:3001
```

Documentação Swagger (se habilitada): `http://localhost:3001/api` (ou o path configurado no projeto).

---

### Desenvolvimento local (só MySQL no Docker)

Para rodar a app no host com hot-reload e usar só o MySQL no Docker:

```bash
docker compose up -d mysql
```

No `.env`, use `DATABASE_URL` apontando para `localhost` e a porta do MySQL (ex.: `mysql://app:app@localhost:3309/ener_extract`). Depois:

```bash
pnpm install
pnpm prisma migrate deploy   # ou migrate dev
pnpm run start:dev
```

---

## Scripts (fora do Docker)

- `pnpm install` — instalar dependências
- `pnpm run start:dev` — desenvolvimento com watch
- `pnpm run build` — build de produção
- `pnpm run test` — testes unitários
- `pnpm run test:e2e` — testes e2e