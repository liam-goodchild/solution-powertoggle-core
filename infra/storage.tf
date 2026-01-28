#tflint-ignore: azurerm_resources_missing_prevent_destroy
#checkov:skip=CKV_AZURE_206:Replication type is configurable via variable
#checkov:skip=CKV_AZURE_44:TLS 1.2 is the default in azurerm provider 4.x
#checkov:skip=CKV_AZURE_190:Public blob access is disabled by default in azurerm provider 4.x
#checkov:skip=CKV_AZURE_33:Queue logging not required - solution uses Table storage only
#checkov:skip=CKV_AZURE_59:Public network access required for serverless function app
#checkov:skip=CKV2_AZURE_41:SAS tokens not used - managed identity authentication
#checkov:skip=CKV2_AZURE_40:Shared key required for function app deployment
#checkov:skip=CKV2_AZURE_38:Soft delete not required for ephemeral schedule data
#checkov:skip=CKV2_AZURE_47:Anonymous blob access disabled by default in azurerm provider 4.x
#checkov:skip=CKV2_AZURE_33:Private endpoint not required for internal automation solution
#checkov:skip=CKV2_AZURE_1:Customer managed keys not required for non-sensitive schedule data
resource "azurerm_storage_account" "sa" {
  name                     = local.storage_account_name
  resource_group_name      = azurerm_resource_group.rg.name
  location                 = azurerm_resource_group.rg.location
  account_tier             = "Standard"
  account_replication_type = var.storage_replication_type
}

#tflint-ignore: azurerm_resources_missing_prevent_destroy
#checkov:skip=CKV2_AZURE_21:Blob logging configured at storage account level if required
resource "azurerm_storage_container" "files" {
  name                  = var.storage_container_name
  storage_account_id    = azurerm_storage_account.sa.id
  container_access_type = "private"
}

#tflint-ignore: azurerm_resources_missing_prevent_destroy
#checkov:skip=CKV2_AZURE_20:Table logging configured at storage account level if required
resource "azurerm_storage_table" "tables" {
  for_each             = local.storage_table_names
  name                 = each.value
  storage_account_name = azurerm_storage_account.sa.name
}