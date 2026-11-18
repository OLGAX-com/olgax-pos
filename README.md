<div align="center">
  <h1>Olgax POS</h1>
  <p>Open-source, offline-capable Point of Sale system — free forever for self-hosted deployments.</p>
  <p>
    <a href="https://olgax.com">olgax.com</a> ·
    <a href="https://discord.gg/EAXcCXgUz2">Discord Community</a> ·
    <a href="docs/getting-started.md">Getting Started</a> ·
    <a href="docs/architecture.md">Architecture</a> ·
    <a href="docs/deployment.md">Deployment</a> ·
    <a href="docs/contributing.md">Contributing</a>
  </p>
  <p>
    <img alt="License MIT" src="https://img.shields.io/badge/license-MIT-blue.svg" />
    <img alt="Version 0.1" src="https://img.shields.io/badge/version-0.1--MVP-orange.svg" />
    <img alt="Next.js 16" src="https://img.shields.io/badge/Next.js-16-black.svg" />
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178c6.svg" />
    <a href="https://discord.com/invite/EAXcCXgUz2"><img alt="Discord" src="https://img.shields.io/badge/Discord-%235865F2.svg?logo=discord&logoColor=white" /></a>
  </p>
</div>

---

## What is Olgax POS?

**Olgax POS** is a fast, touch-friendly, fully offline-capable Point of Sale system built by [OLGAX](https://olgax.com). It is designed to be good enough for real small businesses to use daily — for free, forever — while remaining extensible into a full-featured SaaS platform.

- **Self-hosted** — run it on your own server with Docker in minutes.
- **Offline-first** — uses PGLite (Postgres WASM) to record sales even with no internet, then syncs automatically when connectivity returns.
- **Globally configurable** — change your business name, logo, colors, currency, and tax settings from the UI.
- **Open source** — MIT licensed. Fork it, extend it, run it.

---

## Features (v0.1 MVP)

| Feature | Status |
|---|---|
| Product catalog (create / edit / delete) | ✅ |
| Barcode / keyboard product search | ✅ |
| Stock adjustment history with audit trail | ✅ |
| Supplier management | ✅ |
| POS checkout — cart, qty, discount, tax | ✅ |
| Split-tender payments (Cash + Card + Other) | ✅ |
| Hold & recall orders | ✅ |
| Void sale with reason | ✅ |
| Refund / partial refund support | ✅ |
| Tip support at checkout | ✅ |
| Receipt printing (ESC/POS thermal + browser fallback) | ✅ |
| Customer directory with purchase history | ✅ |
| Loyalty points (earn & redeem) | ✅ |
| Offline mode with auto-sync | ✅ |
| Admin + Cashier roles | ✅ |
| Business settings (logo, colors, currency, tax) | ✅ |
| Sales reports & CSV export | ✅ |
| Breadcrumb navigation on detail pages | ✅ |
| Docker Compose ready | ✅ |
| PWA / installable on tablet | ✅ |

---

## Quick Start (Docker — recommended)

Install Docker with Docker Compose v2 or newer. No source checkout or separate
PostgreSQL installation is needed: Compose starts the published
[`olgaxcom/pos:latest`](https://hub.docker.com/r/olgaxcom/pos) image and a separate
PostgreSQL container together.

### 1. Create `compose.yaml`

In a new folder, save the following as `compose.yaml`:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: olgax
      POSTGRES_PASSWORD: "${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD in .env}"
      POSTGRES_DB: olgax_pos
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "olgax", "-d", "olgax_pos"]
      interval: 5s
      timeout: 5s
      retries: 10

  web:
    image: olgaxcom/pos:latest
    depends_on:
      postgres:
        condition: service_healthy
    ports:
      - "127.0.0.1:3000:3000"
    environment:
      DATABASE_URL: "postgresql://olgax:${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD in .env}@postgres:5432/olgax_pos?schema=public"
      BETTER_AUTH_SECRET: "${BETTER_AUTH_SECRET:?Set BETTER_AUTH_SECRET in .env}"
      BETTER_AUTH_URL: "${BETTER_AUTH_URL:-http://localhost:3000}"
      NEXT_PUBLIC_APP_URL: "${NEXT_PUBLIC_APP_URL:-http://localhost:3000}"

volumes:
  postgres_data:
```

`postgres` is the Compose service name, so it is the database hostname **inside**
the web container. Leave it as `postgres`, not `localhost`. The database port is
not published to your host.

### 2. Create `.env` next to `compose.yaml`

```dotenv
POSTGRES_PASSWORD=replace_with_first_generated_value
BETTER_AUTH_SECRET=replace_with_second_generated_value
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Replace the placeholders with **two different random values**. Run
`openssl rand -hex 32` twice, or run this in PowerShell to generate both values:

```powershell
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try {
    foreach ($key in 'POSTGRES_PASSWORD', 'BETTER_AUTH_SECRET') {
        $bytes = New-Object byte[] 32
        $rng.GetBytes($bytes)
        "$key=$([BitConverter]::ToString($bytes).Replace('-', '').ToLowerInvariant())"
    }
} finally {
    $rng.Dispose()
}
```

Use the generated hex format for the database password so it can be inserted
into `DATABASE_URL` without URL encoding. `BETTER_AUTH_SECRET` signs auth data;
it is not your admin password. Keep `.env` private and preserve these values
across restarts.

For local use, leave both URLs as `http://localhost:3000` and open that exact
address. If you change the host port, update both URLs to match. For access from
another device or a public domain, see the
[HTTPS deployment guide](docs/deployment.md#reverse-proxy-nginx--caddy).

### 3. Start and set up Olgax POS

```bash
docker compose pull
docker compose up -d
```

Open [http://localhost:3000](http://localhost:3000). In the setup wizard, click
**Initialize DB**, create your admin account, and save your store settings.
PostgreSQL data persists in the `postgres_data` volume; `docker compose down`
stops the stack without deleting that data. Use a versioned image tag instead
of `latest` if you want to pin an installation to a specific release.

---

## Quick Start (Serverless — Vercel / Netlify)

You can run Olgax POS serverless without Docker or a VPS:

1. **Fork or Use Template**: Click **Fork** or **Use this template** at the top of this repository to create a copy in your own account.
2. **Deploy**: Import your copy into **Vercel** or **Netlify**.
3. **Database**: Use a managed database provider like Neon or Supabase (using a pooled `DATABASE_URL` and a direct `DIRECT_URL`).

See the [Deployment Guide](docs/deployment.md#serverless-deployments-vercel--netlify) for detailed instructions.

---

## Quick Start (Local Development)

**Prerequisites**: Node.js ≥ 20, pnpm ≥ 9, PostgreSQL ≥ 14

```bash
# 1. Clone & install
git clone https://github.com/olgax/olgax-pos.git
cd olgax-pos
pnpm install

# 2. Configure environment
cp .env.example .env
# Set DATABASE_URL and BETTER_AUTH_SECRET in .env

# 3. Migrate database
pnpm db:migrate

# 4. (Optional) Seed sample products
pnpm db:seed

# 5. Start dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). A setup wizard will guide you through creating your admin account on first run.

---

## Documentation

| Document | Description |
|---|---|
| [Getting Started](docs/getting-started.md) | Full installation guide for all environments |
| [Configuration](docs/configuration.md) | Environment variables, business settings, per-device settings |
| [Architecture](docs/architecture.md) | Tech stack, project structure, data model |
| [Deployment](docs/deployment.md) | Docker, reverse proxy, HTTPS, production checklist |
| [API Reference](docs/api-reference.md) | Internal REST API endpoints |
| [Contributing](docs/contributing.md) | Development workflow, coding standards, PR guide |

---

## Tech Stack

- **Framework**: Next.js 16 App Router + TypeScript strict mode
- **UI**: shadcn/ui + Tailwind CSS 4
- **Database**: PostgreSQL + Prisma 7 ORM
- **Offline DB**: PGLite (Postgres WASM in the browser)
- **Auth**: Better Auth (email/password, role-based)
- **State**: Zustand (POS cart)
- **Forms**: react-hook-form + Zod validation
- **Testing**: Vitest + Playwright

---

## Roadmap

The MVP (v0.1) is designed to be immediately useful for small businesses while laying clean groundwork for future features:

- [ ] Multi-language (next-intl)
- [ ] Multi-store / multi-location
- [ ] Customer directory + loyalty points
- [ ] Plugin system
- [ ] Advanced reports + charts
- [ ] Kitchen Display System (KDS)
- [ ] Hosted SaaS at olgax.app

See [OLGAX Roadmap](https://olgax.com/roadmap) for the full picture.

---

## License

MIT — see [LICENSE](LICENSE) for details.

Built with ❤️ by [OLGAX](https://olgax.com)
