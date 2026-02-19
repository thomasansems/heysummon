# HITLaaS Infrastructure — Azure Container Apps

## Architecture

```
┌──────────────────┐     ┌─────────────────────────┐
│  Vercel (Next.js)│────▶│  Azure Container Apps    │
│  Landing + Auth  │     │  hitlaas-relay service   │
│  Dashboard       │     │  (E2E encrypted relay)   │
└──────────────────┘     └─────────────┬───────────┘
                                       │
                              ┌────────┴────────┐
                              │  Azure Files     │
                              │  (SQLite persist)│
                              └─────────────────┘
```

## Prerequisites

1. [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli) installed
2. [Terraform](https://www.terraform.io/downloads) >= 1.5
3. [Docker](https://docs.docker.com/get-docker/) installed
4. Azure subscription

## Setup

```bash
# 1. Login to Azure
az login

# 2. Copy and edit tfvars
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your subscription ID

# 3. Init and apply Terraform
cd infra/
terraform init
terraform plan
terraform apply

# 4. Build and deploy relay
cd ../relay/
./deploy.sh

# 5. Set RELAY_URL in Vercel
# NEXT_PUBLIC_RELAY_URL = <terraform output relay_url>
```

## Resources Created

| Resource | Purpose | SKU/Tier |
|----------|---------|----------|
| Resource Group | `rg-hitlaas-prod` | — |
| Container Registry | ACR for Docker images | Basic |
| Container App Environment | Managed Kubernetes | Consumption |
| Container App | Relay service (0-3 replicas) | 0.25 CPU / 0.5GB |
| Storage Account | Persistent SQLite volume | Standard LRS |
| Log Analytics | Container logs | PerGB2018 |

## Estimated Cost

- **Container App**: ~€0-5/month (scales to zero when idle)
- **Container Registry**: ~€4/month (Basic)
- **Storage**: ~€0.02/month (1GB file share)
- **Log Analytics**: ~€2/month (minimal data)
- **Total**: ~€6-11/month

## Deploy Updates

```bash
cd relay/
./deploy.sh           # builds, pushes, updates container app
./deploy.sh v1.2.0    # with specific tag
```
