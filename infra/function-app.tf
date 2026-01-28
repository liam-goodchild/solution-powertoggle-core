resource "azurerm_service_plan" "plan" {
  name                = local.service_plan_name
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  os_type             = "Linux"
  sku_name            = "FC1"
}

resource "azurerm_function_app_flex_consumption" "func" {
  name                = local.function_app_name
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  service_plan_id     = azurerm_service_plan.plan.id

  storage_container_type      = "blobContainer"
  storage_container_endpoint  = "${azurerm_storage_account.sa.primary_blob_endpoint}${azurerm_storage_container.files.name}"
  storage_authentication_type = "StorageAccountConnectionString"
  storage_access_key          = azurerm_storage_account.sa.primary_access_key

  runtime_name           = var.runtime_name
  runtime_version        = var.runtime_version
  maximum_instance_count = var.maximum_instance_count
  instance_memory_in_mb  = var.instance_memory_in_mb

  app_settings = local.function_app_app_settings

  identity {
    type = "SystemAssigned"
  }

  site_config {}
}