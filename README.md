## JUNOHUB

JUNOHUB is a Next.js application that powers an admin and supplier portal with:

- Authentication and multi-factor auth
- Gmail integration for support tickets (Juno Engine)
- Shopify integration for orders, products, and inventory
- Knowledge base and FAQ management
- Admin dashboards for stores, suppliers, and email events

The frontend and backend are implemented in a single Next.js App Router project.

---

## Tech Stack

- **Framework**: Next.js (App Router, TypeScript)
- **UI**: React + modern Tailwind-style components
- **Auth**: NextAuth
- **Database**: PostgreSQL (Prisma ORM)
- **Background / Integrations**:
  - Gmail APIs (via OAuth)
  - Shopify APIs
  - Gemini for embeddings and chat
- **Deployment**: Docker + GitHub Actions → AWS EC2

---

## Local Development

1. **Install dependencies**

```bash
npm install
```

2. **Create `.env`**

Copy `.env.example` (or the variables listed below) into a local `.env` file and fill in your own values:

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `GEMINI_API_KEY`
- `GEMINI_EMBEDDING_MODEL`
- `GEMINI_CHAT_MODEL`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

> Never commit real secrets; `.env*` files are ignored by git.

3. **Run the dev server**

```bash
npm run dev
```

Visit `http://localhost:3000` in your browser.

---

## Docker

The project can be run via Docker using the provided `Dockerfile` and `docker-compose.yml`.

Typical pattern:

```bash
docker compose up -d --build
```

Make sure your `.env` is present next to the app code so the container can read it.

---

## CI/CD on AWS EC2

This repo includes a GitHub Actions workflow at `.github/workflows/deploy-ec2.yml` that:

1. Runs on pushes to the `main` branch.
2. Installs dependencies and builds the Next.js app.
3. SSHes into an EC2 instance.
4. Writes an `.env` file on the EC2 instance from a **single GitHub secret** `EC2_ENV`.
5. Uses `docker compose` / `docker-compose` to build and run the app.
6. Performs a health check and **automatically rolls back** to the previous commit if the deployment or health check fails.

### Required GitHub Secrets

Set the following secrets in **GitHub → Settings → Secrets and variables → Actions**:

- `EC2_HOST` – public IP or DNS of the EC2 instance.
- `EC2_USER` – SSH user (e.g. `ubuntu`).
- `EC2_SSH_KEY` – private SSH key for that user.
- `EC2_SSH_PORT` – (optional) port, defaults to `22` if not set.
- `EC2_ENV` – **multi-line secret containing the full contents of the `.env` file** used in production.  
  This is written to `.env` on the server during deployment.

### Deployment Flow

- Push to `main`.
- GitHub Actions:
  - Builds the app.
  - Connects to EC2.
  - Writes `.env` from `EC2_ENV`.
  - Runs `docker compose up -d --build`.
  - Hits the health check URL (by default `http://localhost:3000/api/health`).
- If the health check fails, the workflow:
  - Resets the repo on EC2 to the previous commit.
  - Re-runs `docker compose up -d --build`.

This gives you a sharp deployment with an automatic rollback path.

---

## License

Private / All rights reserved unless explicitly stated otherwise.
