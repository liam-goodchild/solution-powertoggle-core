variable "location" {
  type        = string
  description = "Resource location for Azure resources."
}

variable "tags" {
  type        = map(string)
  description = "Environment tags."
}

variable "environment" {
  type        = string
  description = "Name of Azure environment."
}

variable "project" {
  type        = string
  description = "Project short name."
}
