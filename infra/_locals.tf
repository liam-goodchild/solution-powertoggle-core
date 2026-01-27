locals {
  locations = {
    uksouth = "uks"
  }
  location = local.locations[var.location]
  environment_short = {
    dev = "D"
    prd = "P"
  }
  prefix       = "${var.project}-core-${var.environment}-${local.location}"
  prefix_short = "${var.project}core${local.environment_short[var.environment]}${local.location}"

  # tflint-ignore: terraform_unused_declarations
  st_naming = {
    long  = replace("${local.prefix}-%sst-01", "-", "")
    short = lower("${local.prefix_short}%sst01")
  }
}
