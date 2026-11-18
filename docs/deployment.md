# Deployment Guide

How to deploy Olgax POS in production.

---

## Table of Contents

- [Docker Compose (Recommended)](#docker-compose-recommended)
- [Docker Hub releases](#docker-hub-releases)
- [Serverless Deployments (Vercel / Netlify)](#serverless-deployments-vercel--netlify)
- [Managed 3rd-Party PostgreSQL Providers](#managed-3rd-party-postgresql-providers)
- [Environment Variables for Production](#environment-variables-for-production)
- [Reverse Proxy (Nginx / Caddy)](#reverse-proxy-nginx--caddy)
- [HTTPS Setup](#https-setup)
- [Database Backups](#database-backups)
- [Production Checklist](#production-checklist)
- [Updating](#updating)

---

## Docker Compose (Recommended)

The included `docker-compose.yml` runs both PostgreSQL and the Olgax POS web app.

```bash
# 1. Clone the repo
git clone https://github.com/olgax/olgax-pos.git
cd olgax-pos

# 2. Set production environment
cp .env.example .env
nano .env  # See "Environment Variables for Production" below

# 3. Build and start
NEXT_STANDALONE=1 docker compose up -d --build

# 4. Check logs
docker compose logs -f web
```

The web service will be available on port **3000**. Put it behind Nginx or Caddy for HTTPS.

### Docker Hub releases

Once a release image has been published, pull its GitHub Release tag from the
public `olgaxcom/pos` repository. For example, for release `v0.2.2`:

```bash
docker pull olgaxcom/pos:v0.2.2
```

Pin a version in production. To use the prebuilt image with Compose, replace the
`web` service's `build:` block with `image: olgaxcom/pos:v0.2.2`, using your
chosen release tag. Keep the PostgreSQL service and configure production
credentials before starting the stack. Pulling the image alone does not start
PostgreSQL or configure the POS.

Maintainers: the [CI / Docker Hub workflow](../.github/workflows/docker.yml) runs
Vitest and TypeScript checks before building the image. Pull requests and pushes
to `main` build without signing in to Docker Hub or publishing. Publishing a
GitHub Release pushes the release tag; stable releases also update `latest`.
The workflow expects the Actions variable `DOCKERHUB_USERNAME` and secret
`DOCKERHUB_TOKEN` with permission to push to the public `olgaxcom/pos` repository.

---

## Serverless Deployments (Vercel / Netlify)

Olgax POS can be deployed on serverless hosting platforms like Vercel or Netlify without needing Docker, a VPS, or a virtual machine. 

### Deploying on Vercel (Recommended)

Vercel provides native, optimized support for Next.js applications:

1. **Fork or Use Template**: Click **Fork** or **Use this template** at the top of the [Olgax POS GitHub Repository](https://github.com/olgax/olgax-pos) to create a copy of the project in your own GitHub/GitLab account.
2. **Import Project**: Open the [Vercel Dashboard](https://vercel.com), click **Add New** -> **Project**, and select your imported/forked repository.
3. **Configure Settings**:
   - **Framework Preset**: Select **Next.js**.
   - **Build Command**: `npx prisma generate && next build`
     - *Optional*: If you want migrations to run automatically on every deployment, change the build command to:
       `npx prisma migrate deploy && npx prisma generate && next build`
   - **Environment Variables**: Add your production variables (see [Environment Variables for Production](#environment-variables-for-production) below).
4. **Deploy**: Click **Deploy**. Vercel will compile the application and deploy it to global serverless edge functions.

---

### Deploying on Netlify

Netlify supports Next.js via Netlify Functions:

1. **Import Project**: In the [Netlify Dashboard](https://app.netlify.com), click **Add new site** -> **Import an existing project** and select your repository.
2. **Configure Settings**:
   - **Build command**: `npx prisma generate && next build`
   - **Publish directory**: `.next`
3. **Environment Variables**: Go to **Site settings** -> **Environment variables** and add your production variables.
4. **Deploy**: Trigger the deployment.

---

## Managed 3rd-Party PostgreSQL Providers

Since serverless functions scale up and down dynamically, a standard PostgreSQL database can run out of connections quickly as each edge/serverless function execution thread opens its own pool. It is highly recommended to use a managed database provider that supports **connection pooling**.

### Recommended Providers

| Provider | Features | Ideal Setup |
|---|---|---|
| **Neon** | Serverless Postgres, autoscaling, connection pooling | Use the pooled connection string (`-pooler` endpoint). |
| **Supabase** | Managed Postgres, built-in PgBouncer | Use the connection string with port `6543` (pooling port). |
| **Railway** | Fully managed Postgres, simple provisioning | Good for general use; verify connection limits. |
| **Render** | Simple, managed database instances | Set up connection limits appropriately. |

### Connection Pooling Configuration

When using connection pooling, database operations require two different connection strings:
1. **Pooled Connection (`DATABASE_URL`)**: Used by the Next.js application runtime to handle queries. It allows reusing database connections.
2. **Direct Connection (`DIRECT_URL`)**: Used for running schema migrations (`prisma migrate deploy`) or seeding. Some poolers (like PgBouncer) do not support the transaction types required for migrations.

To use this setup:
- Set `DATABASE_URL` to your provider's **pooled** connection URL.
- Set `DIRECT_URL` to your provider's **direct** connection URL.

Prisma will automatically route migrations through the direct endpoint and runtime queries through the pooled endpoint.

---

## Environment Variables for Production

Edit your `.env` file:

```env
# PostgreSQL connection string (must match docker-compose postgres service config)
DATABASE_URL="postgresql://postgres:YOUR_STRONG_DB_PASSWORD@postgres:5432/olgax_pos"

# Auth secret — generate with: openssl rand -base64 48
BETTER_AUTH_SECRET="your_64_char_random_secret_here"

# The public URL users access the app from
BETTER_AUTH_URL="https://pos.yourshop.com"
NEXT_PUBLIC_APP_URL="https://pos.yourshop.com"

# Comma-separated trusted origins
BETTER_AUTH_TRUSTED_ORIGINS="https://pos.yourshop.com"

NODE_ENV="production"
NEXT_STANDALONE="1"
```

> **Never commit `.env` to version control.** It contains secrets.

---

## Reverse Proxy (Nginx / Caddy)

### Nginx

```nginx
server {
    listen 80;
    server_name pos.yourshop.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name pos.yourshop.com;

    ssl_certificate     /etc/ssl/certs/pos.yourshop.com.crt;
    ssl_certificate_key /etc/ssl/private/pos.yourshop.com.key;

    location / {
        proxy_pass         http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Caddy (automatic HTTPS)

Create a `Caddyfile`:

```
pos.yourshop.com {
    reverse_proxy localhost:3000
}
```

Then run:

```bash
caddy run --config /etc/caddy/Caddyfile
```

Caddy automatically provisions and renews TLS certificates via Let's Encrypt.

---

## HTTPS Setup

HTTPS is strongly recommended (and required for the PWA install prompt).  

**Options:**
- **Caddy** (easiest) — automatic cert management
- **Certbot / Let's Encrypt** — with Nginx
- **Cloudflare Tunnel** — zero-port-forwarding setup for exposing local servers

Once HTTPS is active, update your `.env`:

```env
BETTER_AUTH_URL="https://pos.yourshop.com"
NEXT_PUBLIC_APP_URL="https://pos.yourshop.com"
BETTER_AUTH_TRUSTED_ORIGINS="https://pos.yourshop.com"
```

---

## Database Backups

The Docker Compose setup uses a named volume `postgres_data` for persistence. To back up:

### Manual backup

```bash
docker compose exec postgres pg_dump -U postgres olgax_pos > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restore from backup

```bash
cat backup_20260101_120000.sql | docker compose exec -T postgres psql -U postgres olgax_pos
```

### Automated daily backup (cron example)

```bash
# crontab -e
0 2 * * * cd /path/to/olgax-pos && docker compose exec postgres pg_dump -U postgres olgax_pos > /backups/olgax_$(date +\%Y\%m\%d).sql
```

---

## Production Checklist

Before going live, verify:

- [ ] `BETTER_AUTH_SECRET` is a unique random value ≥ 32 characters
- [ ] `DATABASE_URL` uses a strong password for the Postgres user
- [ ] `NODE_ENV=production` is set
- [ ] HTTPS is configured and working
- [ ] `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` point to your HTTPS domain
- [ ] Backups are configured and tested
- [ ] The setup wizard has been completed (admin account created)
- [ ] Firewall: only port 80/443 exposed publicly (not 3000 or 5432)
- [ ] Postgres port `5432` is **NOT** exposed publicly (remove `ports` from the `postgres` service in `docker-compose.yml` for production)

---

## Updating

```bash
# Pull latest changes
git pull origin main

# Rebuild and restart the app container
NEXT_STANDALONE=1 docker compose up -d --build web

# Apply any new database migrations
docker compose exec web npx prisma migrate deploy
```

> Database migrations run automatically via `prisma migrate deploy` — this is safe to run and only applies new migrations, never rolls back.
