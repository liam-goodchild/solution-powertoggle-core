resource "null_resource" "test_resource" {
  triggers = {
    prefix       = local.prefix
    prefix_short = local.prefix_short
    st_naming    = jsonencode(local.st_naming)
    tags         = jsonencode(local.tags)
  }
}
