output "relay_url" {
  description = "Public URL of the HITLaaS relay service"
  value       = "https://${azurerm_container_app.relay.ingress[0].fqdn}"
}

output "container_registry" {
  description = "ACR login server"
  value       = azurerm_container_registry.hitlaas.login_server
}

output "resource_group" {
  description = "Resource group name"
  value       = azurerm_resource_group.hitlaas.name
}
