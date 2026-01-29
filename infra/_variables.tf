variable "location" {
  description = "Azure region."
  type        = string
}

variable "resource_group_name" {
  description = "Resource group name."
  type        = string
}

variable "name_prefix" {
  type        = string
  description = "Prefix for most resources (hyphens allowed)."
}

variable "storage_prefix" {
  type        = string
  description = "Storage-account-safe prefix: 3-20 chars, lowercase letters and numbers only."

  validation {
    condition     = can(regex("^[a-z0-9]{3,20}$", var.storage_prefix))
    error_message = "storage_prefix must be 3–20 chars, lowercase letters and numbers only."
  }
}

variable "storage_replication_type" {
  description = "Storage replication type (e.g., LRS, GRS, ZRS)."
  type        = string
  default     = "LRS"
}

variable "storage_container_name" {
  description = "Blob container name for function files."
  type        = string
  default     = "function-files"
}

variable "runtime_name" {
  description = "Flex runtime name: dotnet-isolated, java, node, powershell, python."
  type        = string
}

variable "runtime_version" {
  description = "Flex runtime version (stack-specific)."
  type        = string
}

variable "maximum_instance_count" {
  description = "Max scale-out instance count."
  type        = number
  default     = 50
}

variable "instance_memory_in_mb" {
  description = "Instance memory size in MB."
  type        = number
  default     = 2048
}

variable "default_tz" {
  type = string
}

variable "horizon_days" {
  type = string
}

variable "allow_drift_minutes" {
  type = string
}

variable "eventgrid_included_event_types" {
  description = "Optional list of included event types."
  type        = list(string)
  default     = []
}

variable "eventgrid_function_name" {
  description = "Azure Function name (the function inside the app) that has the EventGridTrigger."
  type        = string
}

variable "enable_eventgrid_subscription" {
  type    = bool
  default = false
}
