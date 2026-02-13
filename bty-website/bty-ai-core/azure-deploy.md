# Azure App Service Deployment (bty-ai-core)

## Prerequisites
- Azure CLI
- Docker (for local build test)

## 1. Build & Test Locally

```bash
docker build -t bty-ai-core .
docker run -p 4000:4000 \
  -e OPENAI_API_KEY=your-key \
  -e DATABASE_URL=your-connection-string \
  bty-ai-core
```

## 2. Deploy to Azure App Service

### Option A: Azure Container Registry (ACR) + App Service

```bash
# Login
az login

# Create resource group (if needed)
az group create --name bty-rg --location eastus

# Create ACR
az acr create --resource-group bty-rg --name btyacr --sku Basic

# Build and push
az acr build --registry btyacr --image bty-ai-core:latest .

# Create App Service plan
az appservice plan create --resource-group bty-rg --name bty-plan --is-linux

# Create Web App
az webapp create --resource-group bty-rg --plan bty-plan --name bty-ai-core \
  --deployment-container-image-name btyacr.azurecr.io/bty-ai-core:latest

# Configure ACR credentials
az webapp config container set --resource-group bty-rg --name bty-ai-core \
  --docker-custom-image-name btyacr.azurecr.io/bty-ai-core:latest \
  --docker-registry-server-url https://btyacr.azurecr.io
```

### Option B: Docker Hub

```bash
docker tag bty-ai-core yourusername/bty-ai-core:latest
docker push yourusername/bty-ai-core:latest
# Then create Web App with the image in Azure Portal
```

## 3. Environment Variables (Azure Portal)

In **App Service** > **Configuration** > **Application settings**, add:

| Name | Value |
|------|-------|
| `PORT` | 4000 |
| `OPENAI_API_KEY` | your-openai-key |
| `DATABASE_URL` | postgresql://... (if using DB) |

## 4. Health Check

- **Endpoint:** `GET /health`
- **Response:** `{ "status": "ok", "service": "bty-ai-core" }`

Azure App Service can use this for health monitoring:
**App Service** > **Settings** > **Health check** > Path: `/health`
