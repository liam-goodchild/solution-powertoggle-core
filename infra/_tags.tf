locals {
  tags = merge(
    {
      # Required
      Environment  = var.environment == "prd" ? "Prod" : title(var.environment)
      Criticality  = "PLACEHOLDER"
      BusinessUnit = "PLACEHOLDER"
      Owner        = "PLACEHOLDER@PLACEHOLDER.com"
      CostCenter   = "PLACEHOLDER"
      Application  = "PLACEHOLDER"
      OpsTeam      = "PLACEHOLDER"

      # Optional
      Reposiotry = "PLACEHOLDER"
      Project    = "PLACEHOLDER"
    },
    var.tags
  )
}
