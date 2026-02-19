#!/bin/bash
set -euo pipefail

# HITLaaS Relay — Build & Deploy to Azure Container Apps
# Usage: ./deploy.sh [tag]

TAG="${1:-latest}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
INFRA_DIR="$SCRIPT_DIR/../infra"

echo "🔐 HITLaaS Relay Deploy"
echo "========================"

# Get ACR info from Terraform
cd "$INFRA_DIR"
ACR_SERVER=$(terraform output -raw container_registry 2>/dev/null)
RG=$(terraform output -raw resource_group 2>/dev/null)

if [ -z "$ACR_SERVER" ]; then
  echo "❌ Terraform outputs not found. Run 'terraform apply' first."
  exit 1
fi

echo "📦 Building Docker image..."
cd "$SCRIPT_DIR"
docker build -t "hitlaas-relay:$TAG" .

echo "🏷️  Tagging for ACR: $ACR_SERVER/hitlaas-relay:$TAG"
docker tag "hitlaas-relay:$TAG" "$ACR_SERVER/hitlaas-relay:$TAG"

echo "🔑 Logging into ACR..."
az acr login --name "${ACR_SERVER%%.*}"

echo "⬆️  Pushing to ACR..."
docker push "$ACR_SERVER/hitlaas-relay:$TAG"

echo "🔄 Updating Container App..."
CONTAINER_APP=$(az containerapp list -g "$RG" --query "[?contains(name, 'relay')].name" -o tsv)
az containerapp update -n "$CONTAINER_APP" -g "$RG" \
  --image "$ACR_SERVER/hitlaas-relay:$TAG"

echo ""
echo "✅ Deployed hitlaas-relay:$TAG"
RELAY_URL=$(cd "$INFRA_DIR" && terraform output -raw relay_url)
echo "🌐 Relay URL: $RELAY_URL"
echo "❤️  Health: $RELAY_URL/health"
