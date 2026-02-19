terraform {
  required_version = ">= 1.5.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }

  backend "local" {
    path = "terraform.tfstate"
  }
}

provider "azurerm" {
  features {}
  subscription_id = var.subscription_id
}

# ── Resource Group ─────────────────────────────────────────────────────────────

resource "azurerm_resource_group" "hitlaas" {
  name     = "rg-hitlaas-${var.environment}"
  location = var.location

  tags = {
    project     = "hitlaas"
    environment = var.environment
    managed_by  = "terraform"
  }
}

# ── Log Analytics Workspace (required for Container Apps) ──────────────────────

resource "azurerm_log_analytics_workspace" "hitlaas" {
  name                = "law-hitlaas-${var.environment}"
  location            = azurerm_resource_group.hitlaas.location
  resource_group_name = azurerm_resource_group.hitlaas.name
  sku                 = "PerGB2018"
  retention_in_days   = 30

  tags = azurerm_resource_group.hitlaas.tags
}

# ── Container App Environment ─────────────────────────────────────────────────

resource "azurerm_container_app_environment" "hitlaas" {
  name                       = "cae-hitlaas-${var.environment}"
  location                   = azurerm_resource_group.hitlaas.location
  resource_group_name        = azurerm_resource_group.hitlaas.name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.hitlaas.id

  tags = azurerm_resource_group.hitlaas.tags
}

# ── Container Registry ────────────────────────────────────────────────────────

resource "azurerm_container_registry" "hitlaas" {
  name                = "crhitlaas${var.environment}"
  location            = azurerm_resource_group.hitlaas.location
  resource_group_name = azurerm_resource_group.hitlaas.name
  sku                 = "Basic"
  admin_enabled       = true

  tags = azurerm_resource_group.hitlaas.tags
}

# ── Storage Account (persistent volume for SQLite) ────────────────────────────

resource "azurerm_storage_account" "hitlaas" {
  name                     = "sthitlaas${var.environment}"
  location                 = azurerm_resource_group.hitlaas.location
  resource_group_name      = azurerm_resource_group.hitlaas.name
  account_tier             = "Standard"
  account_replication_type = "LRS"

  tags = azurerm_resource_group.hitlaas.tags
}

resource "azurerm_storage_share" "relay_data" {
  name               = "relay-data"
  storage_account_id = azurerm_storage_account.hitlaas.id
  quota              = 1 # GB
}

# ── Storage mount in Container App Environment ────────────────────────────────

resource "azurerm_container_app_environment_storage" "relay_data" {
  name                         = "relay-data"
  container_app_environment_id = azurerm_container_app_environment.hitlaas.id
  account_name                 = azurerm_storage_account.hitlaas.name
  share_name                   = azurerm_storage_share.relay_data.name
  access_key                   = azurerm_storage_account.hitlaas.primary_access_key
  access_mode                  = "ReadWrite"
}

# ── Container App: Relay Service ──────────────────────────────────────────────

resource "azurerm_container_app" "relay" {
  name                         = "ca-hitlaas-relay-${var.environment}"
  container_app_environment_id = azurerm_container_app_environment.hitlaas.id
  resource_group_name          = azurerm_resource_group.hitlaas.name
  revision_mode                = "Single"

  registry {
    server               = azurerm_container_registry.hitlaas.login_server
    username             = azurerm_container_registry.hitlaas.admin_username
    password_secret_name = "acr-password"
  }

  secret {
    name  = "acr-password"
    value = azurerm_container_registry.hitlaas.admin_password
  }

  template {
    min_replicas = 0
    max_replicas = 3

    container {
      name   = "relay"
      image  = "${azurerm_container_registry.hitlaas.login_server}/hitlaas-relay:latest"
      cpu    = 0.25
      memory = "0.5Gi"

      env {
        name  = "PORT"
        value = "4000"
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }

      env {
        name  = "RELAY_DB_PATH"
        value = "/data/relay.db"
      }

      env {
        name  = "CORS_ORIGIN"
        value = var.cors_origin
      }

      volume_mounts {
        name = "relay-data"
        path = "/data"
      }

      liveness_probe {
        transport = "HTTP"
        path      = "/health"
        port      = 4000
      }

      readiness_probe {
        transport = "HTTP"
        path      = "/health"
        port      = 4000
      }
    }

    volume {
      name         = "relay-data"
      storage_name = azurerm_container_app_environment_storage.relay_data.name
      storage_type = "AzureFile"
    }
  }

  ingress {
    external_enabled = true
    target_port      = 4000
    transport        = "http"

    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }

  tags = azurerm_resource_group.hitlaas.tags
}
