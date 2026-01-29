locals {
  subscription_scope_id       = "/subscriptions/${data.azurerm_client_config.current.subscription_id}"
  storage_account_name        = "${var.storage_prefix}st01"
  service_plan_name           = "${var.name_prefix}-asp-01"
  function_app_name           = "${var.name_prefix}-fa-01"
  eventgrid_subscription_name = "${var.name_prefix}-evgs-01"
  eventgrid_topic_name        = "${var.name_prefix}-evst-01"

  storage_table_names = toset([
    "VmSchedules",
    "DueIndex",
  ])
}

locals {
  tables_url = "https://${azurerm_storage_account.sa.name}.table.core.windows.net"

  function_app_app_settings = {
    TABLES_URL          = local.tables_url
    DEFAULT_TZ          = var.default_tz
    HORIZON_DAYS        = var.horizon_days
    ALLOW_DRIFT_MINUTES = var.allow_drift_minutes
  }
}