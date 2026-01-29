# PowerToggle

## Purpose

This solution provides automated power management for Azure Virtual Machines using resource tags. The goal is to enable cost optimization by automatically starting and stopping VMs on configurable schedules without requiring infrastructure code changes.

### Benefits

- **Cost Optimization** - Automatically deallocate non-production VMs during off-hours to reduce compute costs
- **Tag-Driven Configuration** - Add or modify schedules by simply updating VM tags; no Terraform or code changes required
- **Timezone-Aware Scheduling** - Specify schedules in local time with automatic UTC conversion
- **Event-Driven Architecture** - Changes to VM tags are processed immediately via Event Grid
- **Stale Action Prevention** - Hash-based validation ensures outdated schedule actions are never executed

---

## Architecture

The solution uses a three-function event-driven architecture:

```
Azure VMs (with tags)
    |
    v
Event Grid System Topic
    |
    v
TagIngest Function --> VmSchedules Table (source of truth)
                            |
                            v
                       DueIndex Table (action queue)
                            |
                            v
Scheduler Function (runs every minute)
    |
    v
Execute Start/Stop Operations on VMs
```

### Functions

| Function        | Trigger              | Purpose                                              |
| --------------- | -------------------- | ---------------------------------------------------- |
| **TagIngest**   | Event Grid           | Ingests VM tag changes and populates schedule tables |
| **DailyExtend** | Timer (00:05 UTC)    | Maintains rolling window of scheduled actions        |
| **Scheduler**   | Timer (every minute) | Executes power operations for the current minute     |

---

## Configuration

### VM Tags

Configure automation by applying these tags to Azure Virtual Machines:

| Tag                | Purpose                 | Format          | Required | Default |
| ------------------ | ----------------------- | --------------- | -------- | ------- |
| `AutoStart`        | VM start time           | HH:mm (24-hour) | No\*     | -       |
| `AutoStop`         | VM stop/deallocate time | HH:mm (24-hour) | No\*     | -       |
| `AutoEnabled`      | Enable/disable schedule | true/false      | No       | true    |
| `AutoWeekdaysOnly` | Monday-Friday only      | true/false      | No       | false   |

\*At least one of `AutoStart` or `AutoStop` must be set.

### Example

To configure a VM to start at 9:00 AM and stop at 6:00 PM on weekdays only:

```
AutoStart: 09:00
AutoStop: 18:00
AutoEnabled: true
AutoWeekdaysOnly: true
```

---

## Deployment

### Prerequisites

- Azure subscription with Contributor access
- Azure DevOps with service connection configured
- Terraform state storage account

### Pipeline Deployment

The solution deploys via Azure DevOps pipelines:

1. **CI Pipeline** - Validates Terraform and runs linting on pull requests
2. **CD Pipeline** - Deploys infrastructure and functions to target environments

The CD pipeline follows a multi-stage approach:

1. Deploy base infrastructure (without Event Grid subscription)
2. Build and deploy Azure Functions
3. Wait for function registration
4. Enable Event Grid subscription

### Manual Deployment

```bash
# Deploy infrastructure (first stage)
cd infra
terraform init -backend-config=...
terraform plan -var-file="vars/uks/dev.tfvars" -var="enable_eventgrid_subscription=false"
terraform apply -var-file="vars/uks/dev.tfvars" -var="enable_eventgrid_subscription=false"

# Deploy functions
cd ../functions/src
npm ci
zip -r ../function.zip .
az functionapp deployment source config-zip -g <resource-group> -n <function-app> --src ../function.zip

# Enable Event Grid (second stage)
cd ../infra
terraform apply -var-file="vars/uks/dev.tfvars" -var="enable_eventgrid_subscription=true"
```

---

## Project Structure

```
solution-powertoggle-core/
├── .azuredevops/           # CI/CD pipeline definitions
├── functions/src/          # Azure Functions (Node.js)
│   ├── functions/
│   │   ├── TagIngest.js    # Event Grid trigger
│   │   ├── DailyExtend.js  # Daily timer trigger
│   │   └── Scheduler.js    # Minute timer trigger
│   └── package.json
└── infra/                  # Terraform configuration
    └── vars/               # Environment-specific variables
```

---

## Summary

PowerToggle Core automates Azure VM power management through a tag-based configuration system. By applying simple tags to VMs, schedules are automatically ingested and executed without infrastructure changes. The three-function architecture provides reliable, timezone-aware scheduling with built-in safeguards against stale action execution.

---

## Terraform Documentation

<!-- prettier-ignore-start -->
<!-- textlint-disable -->
<!-- BEGIN_TF_DOCS -->
## Requirements

| Name | Version |
|------|---------|
| <a name="requirement_terraform"></a> [terraform](#requirement\_terraform) | >= 1.0, < 2.0 |
| <a name="requirement_azuread"></a> [azuread](#requirement\_azuread) | >= 3.0, < 4.0 |
| <a name="requirement_azurerm"></a> [azurerm](#requirement\_azurerm) | >= 4.0, < 5.0 |

## Resources

| Name | Type |
|------|------|
| [azurerm_eventgrid_system_topic.rm_subscription](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/eventgrid_system_topic) | resource |
| [azurerm_eventgrid_system_topic_event_subscription.to_function](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/eventgrid_system_topic_event_subscription) | resource |
| [azurerm_function_app_flex_consumption.func](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/function_app_flex_consumption) | resource |
| [azurerm_resource_group.rg](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/resource_group) | resource |
| [azurerm_role_assignment.func_table_contributor_sa](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/role_assignment) | resource |
| [azurerm_role_assignment.func_vm_contributor_sub](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/role_assignment) | resource |
| [azurerm_service_plan.plan](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/service_plan) | resource |
| [azurerm_storage_account.sa](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/storage_account) | resource |
| [azurerm_storage_container.files](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/storage_container) | resource |
| [azurerm_storage_table.tables](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/storage_table) | resource |
| [azurerm_client_config.current](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/client_config) | data source |

## Modules

No modules.

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|:--------:|
| <a name="input_allow_drift_minutes"></a> [allow\_drift\_minutes](#input\_allow\_drift\_minutes) | n/a | `string` | n/a | yes |
| <a name="input_default_tz"></a> [default\_tz](#input\_default\_tz) | n/a | `string` | n/a | yes |
| <a name="input_eventgrid_function_name"></a> [eventgrid\_function\_name](#input\_eventgrid\_function\_name) | Azure Function name (the function inside the app) that has the EventGridTrigger. | `string` | n/a | yes |
| <a name="input_horizon_days"></a> [horizon\_days](#input\_horizon\_days) | n/a | `string` | n/a | yes |
| <a name="input_location"></a> [location](#input\_location) | Azure region. | `string` | n/a | yes |
| <a name="input_name_prefix"></a> [name\_prefix](#input\_name\_prefix) | Prefix for most resources (hyphens allowed). | `string` | n/a | yes |
| <a name="input_resource_group_name"></a> [resource\_group\_name](#input\_resource\_group\_name) | Resource group name. | `string` | n/a | yes |
| <a name="input_runtime_name"></a> [runtime\_name](#input\_runtime\_name) | Flex runtime name: dotnet-isolated, java, node, powershell, python. | `string` | n/a | yes |
| <a name="input_runtime_version"></a> [runtime\_version](#input\_runtime\_version) | Flex runtime version (stack-specific). | `string` | n/a | yes |
| <a name="input_storage_prefix"></a> [storage\_prefix](#input\_storage\_prefix) | Storage-account-safe prefix: 3-20 chars, lowercase letters and numbers only. | `string` | n/a | yes |
| <a name="input_enable_eventgrid_subscription"></a> [enable\_eventgrid\_subscription](#input\_enable\_eventgrid\_subscription) | n/a | `bool` | `false` | no |
| <a name="input_eventgrid_included_event_types"></a> [eventgrid\_included\_event\_types](#input\_eventgrid\_included\_event\_types) | Optional list of included event types. | `list(string)` | `[]` | no |
| <a name="input_instance_memory_in_mb"></a> [instance\_memory\_in\_mb](#input\_instance\_memory\_in\_mb) | Instance memory size in MB. | `number` | `2048` | no |
| <a name="input_maximum_instance_count"></a> [maximum\_instance\_count](#input\_maximum\_instance\_count) | Max scale-out instance count. | `number` | `50` | no |
| <a name="input_storage_container_name"></a> [storage\_container\_name](#input\_storage\_container\_name) | Blob container name for function files. | `string` | `"function-files"` | no |
| <a name="input_storage_replication_type"></a> [storage\_replication\_type](#input\_storage\_replication\_type) | Storage replication type (e.g., LRS, GRS, ZRS). | `string` | `"LRS"` | no |

## Outputs

No outputs.
<!-- END_TF_DOCS -->
<!-- textlint-enable -->
<!-- prettier-ignore-end -->
