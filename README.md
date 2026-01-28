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
<!-- END_TF_DOCS -->
<!-- textlint-enable -->
<!-- prettier-ignore-end -->
