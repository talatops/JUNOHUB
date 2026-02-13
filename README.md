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
  - AWS Bedrock for embeddings and chat (Titan Text Embeddings V2 + Claude 3 Haiku)
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
- `AWS_ACCESS_KEY_ID` (for AWS Bedrock)
- `AWS_SECRET_ACCESS_KEY` (for AWS Bedrock)
- `AWS_REGION` (default: `us-east-1`)
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

## AWS Bedrock Setup

The knowledge base feature uses AWS Bedrock for AI-powered embeddings and chat completion.

### Prerequisites

1. **AWS Account**: Create an account at https://aws.amazon.com/
2. **Enable Bedrock Access**: 
   - Go to https://console.aws.amazon.com/bedrock/
   - Navigate to "Model access" in the left sidebar
   - Request access to:
     - **Amazon Titan Text Embeddings V2** (for embeddings)
     - **Anthropic Claude 3 Haiku** (for chat completion)
   - Wait for approval (usually instant for Titan, may take a few hours for Claude)

### IAM Setup

Create an IAM user or role with Bedrock permissions:

1. Go to IAM Console → Users (or Roles)
2. Create a new user/role or select existing
3. Attach the following policy (or create a custom policy):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["bedrock:InvokeModel"],
      "Resource": [
        "arn:aws:bedrock:*::foundation-model/amazon.titan-embed-text-v2:0",
        "arn:aws:bedrock:*::foundation-model/anthropic.claude-3-haiku-20240307-v1:0"
      ]
    }
  ]
}
```

4. **Create Access Keys** (for IAM user):
   - Go to Security credentials tab
   - Click "Create access key"
   - Choose "Application running outside AWS" or "EC2" depending on your deployment
   - Copy the Access Key ID and Secret Access Key
   - Add these to your `.env` file

### Environment Variables

Add to your `.env` file:

```bash
AWS_ACCESS_KEY_ID="your-access-key-id"
AWS_SECRET_ACCESS_KEY="your-secret-access-key"
AWS_REGION="us-east-1"  # or your preferred region
```

### Database Migration

After setting up AWS Bedrock, you need to migrate existing embeddings:

1. **Run the database migration** to change embedding dimensions from 1536 to 1024:
   ```bash
   npx prisma migrate deploy
   ```

2. **Re-embed existing knowledge base data**:
   ```bash
   npm run re-embed-knowledge-base
   ```
   
   This script will:
   - Read all existing `KnowledgeChunk` records
   - Generate new 1024-dimension embeddings using Bedrock Titan V2
   - Update the database with new embeddings
   - Process in batches to avoid rate limiting

### Models Used

- **Embeddings**: Amazon Titan Text Embeddings V2 (`amazon.titan-embed-text-v2:0`)
  - Output dimension: 1024 (configurable: 256, 512, or 1024)
  - Used for: FAQ embeddings, document chunk embeddings, query embeddings

- **Chat**: Anthropic Claude 3 Haiku (`anthropic.claude-3-haiku-20240307-v1:0`)
  - Used for: RAG (Retrieval-Augmented Generation) query responses
  - Fast and cost-effective for knowledge base Q&A

### Optional: Override Models

You can override the default models via environment variables:

```bash
BEDROCK_EMBEDDING_MODEL="amazon.titan-embed-text-v2:0"
BEDROCK_CHAT_MODEL="anthropic.claude-3-haiku-20240307-v1:0"
```

### Prisma:

If you want to visualize the database:
```
export DATABASE_URL='<YOUR_DB_URL>'
npx prisma studio
```


### Troubleshooting

- **"Access Denied" errors**: Ensure Bedrock model access is enabled in AWS Console
- **"Invalid credentials"**: Verify `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are correct
- **"Model not found"**: Check that you've requested access to the models in Bedrock Console
- **Re-embedding fails**: Ensure AWS credentials are set and Bedrock access is enabled

---

## License

Private / All rights reserved unless explicitly stated otherwise.
