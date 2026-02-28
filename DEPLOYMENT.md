# HeySummon Platform — Deployment Guide

## Quick Start (Docker Compose)

```bash
# Start app + PostgreSQL locally
docker compose up -d

# Run database migrations
docker compose exec app npx prisma migrate deploy

# Open http://localhost:3425
```

## Docker Build

```bash
# Build image
docker build -t heysummon-platform .

# Run standalone (needs DATABASE_URL)
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/heysummon" \
  -e NEXTAUTH_URL="http://localhost:3425" \
  -e NEXTAUTH_SECRET="your-secret-here" \
  heysummon-platform
```

## Azure Deployment (Terraform)

### Prerequisites
- [Terraform](https://terraform.io) >= 1.5
- [Azure CLI](https://learn.microsoft.com/cli/azure/) logged in (`az login`)
- An Azure subscription

### Steps

```bash
cd infra/

# Copy and edit variables
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values

# Deploy
terraform init
terraform plan
terraform apply
```

### What gets created
| Resource | Purpose |
|----------|---------|
| Resource Group | `rg-heysummon-prod` |
| Container Registry (ACR) | Store Docker images |
| Container App Environment | Serverless container hosting |
| Container App | The HeySummon platform |
| PostgreSQL Flexible Server | Database (Burstable B1ms) |
| Log Analytics Workspace | Logging & monitoring |

### Push image to ACR

```bash
# Login to ACR
az acr login --name heysummonprod

# Tag and push
docker tag heysummon-platform heysummonprod.azurecr.io/heysummon-platform:latest
docker push heysummonprod.azurecr.io/heysummon-platform:latest
```

### Estimated cost
- **Container App**: ~€0-5/mo (scales to zero)
- **PostgreSQL B1ms**: ~€12/mo
- **ACR Basic**: ~€4.50/mo
- **Total**: ~€17-22/mo

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `NEXTAUTH_URL` | ✅ | Public URL of the platform |
| `NEXTAUTH_SECRET` | ✅ | Random secret for session encryption |
| `AUTH_GITHUB_ID` | For OAuth | GitHub OAuth App client ID |
| `AUTH_GITHUB_SECRET` | For OAuth | GitHub OAuth App client secret |
| `AUTH_GOOGLE_ID` | For OAuth | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | For OAuth | Google OAuth client secret |

## Security

### Built-in protections
- **Rate limiting**: 60 req/min general, 30 req/min for API v1 (per IP)
- **CORS**: Restricted to configured origins
- **Security headers**: HSTS, X-Frame-Options DENY, CSP, nosniff (via `next.config.ts`)
- **Request size limit**: 1MB max body
- **E2E encryption**: RSA-OAEP + AES-256-GCM for all help requests
- **API key auth**: Required for all v1 endpoints
- **Timing-safe comparison**: API key validation resistant to timing attacks

### Production checklist
- [ ] Set strong `NEXTAUTH_SECRET` (min 32 chars)
- [ ] Configure OAuth providers with correct redirect URIs
- [ ] Set `DATABASE_URL` to managed PostgreSQL (not SQLite)
- [ ] Enable Azure Container App ingress with HTTPS only
- [ ] Set up Azure Monitor alerts for error rates
- [ ] Configure backup for PostgreSQL
- [ ] Review and restrict CORS origins in `src/middleware.ts`
