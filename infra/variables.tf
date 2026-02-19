variable "subscription_id" {
  description = "Azure subscription ID"
  type        = string
}

variable "location" {
  description = "Azure region"
  type        = string
  default     = "westeurope"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "cors_origin" {
  description = "Allowed CORS origin for the relay API"
  type        = string
  default     = "https://hitlaas.vercel.app"
}
