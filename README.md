# Overview

An Azure-based VM power management automation system that automatically starts and stops virtual machines on a schedule using resource tags making it easy to manage schedules without modifying infrastructure code.

## Architecture

### Terraform Resources

| Resource | Type | Description |
|----------|------|-------------|
| `azurerm_resource_group.rg` | Resource Group | Contains all solution resources |
| `azurerm_storage_account.sa` | Storage Account | Hosts table storage for schedules |
| `azurerm_storage_container.files` | Blob Container | Stores function app deployment files |
| `azurerm_storage_table.tables` | Storage Tables | `VmSchedules` and `DueIndex` tables |
| `azurerm_service_plan.plan` | App Service Plan | Flex Consumption (FC1) plan for functions |
| `azurerm_function_app_flex_consumption.func` | Function App | Hosts the three Azure Functions |
| `azurerm_eventgrid_system_topic.rm_subscription` | Event Grid Topic | Subscription-level resource monitoring |
| `azurerm_eventgrid_system_topic_event_subscription.to_function` | Event Subscription | Routes VM events to TagIngest |
| `azurerm_role_assignment.func_vm_contributor_sub` | Role Assignment | Virtual Machine Contributor at subscription scope |
| `azurerm_role_assignment.func_table_contributor_sa` | Role Assignment | Storage Table Data Contributor on storage account |

### Workflow

```
+------------------+     +-------------------+     +------------------+
|   Azure VMs      |     |   Event Grid      |     |   TagIngest      |
|   (with tags)    +---->+   System Topic    +---->+   Function       |
+------------------+     +-------------------+     +--------+---------+
                                                           |
                                                           v
+------------------+     +-------------------+     +------------------+
|   Scheduler      |     |   DueIndex        |     |   VmSchedules    |
|   Function       +<----+   Table           +<----+   Table          |
+--------+---------+     +-------------------+     +------------------+
         |
         v
+------------------+
|   Start/Stop     |
|   VMs            |
+------------------+
```

## How It Works

### 1. Schedule Configuration (TagIngest)

When a VM is created or modified, Event Grid triggers the **TagIngest** function which:

1. Reads the VM's schedule tags (`AutoStart`, `AutoStop`, `AutoEnabled`, `AutoWeekdaysOnly`)
2. Stores the schedule configuration in the `VmSchedules` table
3. Immediately populates the `DueIndex` table with upcoming power actions

### 2. Schedule Extension (DailyExtend)

The **DailyExtend** function runs daily at 00:05 UTC to:

1. Read all enabled schedules from `VmSchedules`
2. Generate power actions for the configured horizon (default: 1 day)
3. Upsert entries into `DueIndex` to maintain a rolling window of scheduled actions

### 3. Action Execution (Scheduler)

The **Scheduler** function runs every minute to:

1. Query `DueIndex` for actions due in the current UTC minute (with configurable drift tolerance)
2. Validate each action against the current schedule in `VmSchedules`
3. Execute the power operation (start or deallocate)
4. Remove processed/stale entries from `DueIndex`

### Schedule Hash Validation

Each schedule has a computed hash based on its configuration. When the Scheduler executes an action, it compares the hash in `DueIndex` with the current hash in `VmSchedules`. If they differ (schedule was modified), the stale action is discarded. This prevents executing outdated schedules after tag changes.

### VM Tags

Configure VM schedules using these Azure resource tags:

| Tag | Description | Example | Required |
|-----|-------------|---------|----------|
| `AutoStart` | Time to start the VM (24-hour format, HH:mm) | `09:00` | No |
| `AutoStop` | Time to stop/deallocate the VM (24-hour format, HH:mm) | `17:30` | No |
| `AutoEnabled` | Enable or disable the schedule | `true` / `false` (default: `true`) | No |
| `AutoWeekdaysOnly` | Only run schedule on weekdays (Mon-Fri) | `true` / `false` (default: `false`) | No |

At least one of `AutoStart` or `AutoStop` must be set for the schedule to be active.

## Deployment

### Prerequisites

- Azure subscription with Contributor access
- Azure DevOps with service connection configured
- Terraform state storage account

### Pipeline

The solution uses Azure DevOps Pipelines with a multi-stage deployment:

1. **Terraform Base** - Deploys infrastructure without Event Grid subscription
2. **Function Deploy** - Builds and deploys the Node.js function code
3. **Wait for Function** - Polls ARM API until the TagIngest function is registered
4. **Terraform EventGrid** - Creates the Event Grid subscription (requires function to exist first)

### Manual Deployment

```bash
# Initialize Terraform
cd infra
terraform init \
  -backend-config="resource_group_name=<state-rg>" \
  -backend-config="storage_account_name=<state-storage>" \
  -backend-config="container_name=<state-container>" \
  -backend-config="key=terraform.tfstate"

# Plan (without Event Grid subscription initially)
terraform plan -var-file="vars/dev.tfvars" -var="enable_eventgrid_subscription=false"

# Apply base infrastructure
terraform apply -var-file="vars/dev.tfvars" -var="enable_eventgrid_subscription=false"

# Deploy function code
cd ../functions
npm ci && npm run build
func azure functionapp publish <function-app-name>

# Enable Event Grid subscription
cd ../infra
terraform apply -var-file="vars/dev.tfvars" -var="enable_eventgrid_subscription=true"
```

## Configuration

### Terraform Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `location` | Azure region | Required |
| `resource_group_name` | Resource group name | Required |
| `name_prefix` | Prefix for resource names (hyphens allowed) | Required |
| `storage_prefix` | Storage account prefix (3-20 chars, lowercase alphanumeric) | Required |
| `storage_replication_type` | Storage replication (LRS, GRS, ZRS) | `LRS` |
| `storage_container_name` | Blob container for function files | `function-files` |
| `runtime_name` | Function runtime (node, python, etc.) | Required |
| `runtime_version` | Runtime version | Required |
| `maximum_instance_count` | Max function scale-out instances | `50` |
| `instance_memory_in_mb` | Function instance memory | `2048` |
| `default_tz` | Default timezone for schedules | Required |
| `horizon_days` | Days ahead to schedule actions | Required |
| `allow_drift_minutes` | Minutes of drift tolerance for scheduler | Required |
| `eventgrid_included_event_types` | Event types to subscribe to | `[]` |
| `eventgrid_function_name` | Function name for Event Grid endpoint | Required |
| `enable_eventgrid_subscription` | Enable/disable Event Grid subscription | `false` |

### Environment Variables (Function App)

| Variable | Description |
|----------|-------------|
| `TABLES_URL` | Azure Table Storage endpoint URL |
| `DEFAULT_TZ` | Default timezone (e.g., `Europe/London`) |
| `HORIZON_DAYS` | Number of days to schedule ahead |
| `ALLOW_DRIFT_MINUTES` | Tolerance for late execution |

## Environments

| Environment | Resource Group | Function App |
|-------------|----------------|--------------|
| Development | `sh-app-dev-uks-pwt-rg-01` | `sh-app-dev-uks-pwt-fa-01` |
| Production | `sh-app-prd-uks-pwt-rg-01` | `sh-app-prd-uks-pwt-fa-01` |