<!-- prettier-ignore-start -->
<!-- textlint-disable -->

# Repository Setup Standards

This document defines the standard for setting up a new repository from this template.

The primary objective is to ensure all repositories maintain consistent configuration, security settings, and documentation from the outset.

- Ensures security features are enabled from day one
- Maintains consistent branch protection across all repositories
- Provides a repeatable, standardised setup process
- Reduces configuration drift between projects
- Enables automated documentation generation

---

## 1. Set Default Branch

In GitHub, set the default branch to:

- `main`

---

## 2. Enable Security Settings

Enable the following security features on the repository:

- Security advisories
- Dependabot
- Code scanning
- Secret scanning

---

## 3. Import Branch Ruleset

Import the following JSON as a **branch ruleset**:

```json
{
  "id": 12143210,
  "name": "main-branch-protection",
  "target": "branch",
  "source_type": "Repository",
  "source": "liam-goodchild/docs-engineering-standards",
  "enforcement": "active",
  "conditions": {
    "ref_name": {
      "exclude": [],
      "include": [
        "~DEFAULT_BRANCH"
      ]
    }
  },
  "rules": [
    {
      "type": "deletion"
    },
    {
      "type": "non_fast_forward"
    },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "required_reviewers": [],
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false,
        "allowed_merge_methods": [
          "merge",
          "squash",
          "rebase"
        ]
      }
    }
  ],
  "bypass_actors": []
}
```

---

## 4. Rename Repository

Rename the repository using the following AI prompt:

```text
The repository will contain [description].
Suggest a repository name following the naming convention at:
https://raw.githubusercontent.com/liam-goodchild/docs-engineering-standards/main/repo-standards/repo-naming/README.md
```

---

## 5. Create CI/CD Pipelines, Service Principals and Service Connections

Create the CI/CD pipelines in the relevant folder within Azure DevOps, ensuring that the CD pipeline has pull request validation manually disabled before opening a PR. Create the necessary service principals and service connections and ensure appropriate RBAC is granted.

---

## 6. Update Pipeline Placeholders

Update placeholder container and service connection names in the various pipelines with the generated values.

---

## 7. Generate README

Once the code in the repository is in a working state, generate a README using the following AI prompt:

```text
The repository is for [description of your project].
Generate a README for my new repository following the template at:
https://raw.githubusercontent.com/liam-goodchild/docs-engineering-standards/main/readme-standards/README.md
```

---

## 8. Add Terraform Documentation Block

Add the following block into the README for automated Terraform documentation:

```text
<!-- prettier-ignore-start -->
<!-- textlint-disable -->
<!-- BEGIN_TF_DOCS -->
## Requirements

| Name | Version |
|------|---------|
| <a name="requirement_terraform"></a> [terraform](#requirement\_terraform) | >= 1.0, < 2.0 |
| <a name="requirement_azurerm"></a> [azurerm](#requirement\_azurerm) | >= 4.0, < 5.0 |
| <a name="requirement_null"></a> [null](#requirement\_null) | >= 3.0, < 4.0 |

## Resources

| Name | Type |
|------|------|
| [null_resource.test_resource](https://registry.terraform.io/providers/hashicorp/null/latest/docs/resources/resource) | resource |

## Modules

No modules.

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|:--------:|
| <a name="input_environment"></a> [environment](#input\_environment) | Name of Azure environment. | `string` | n/a | yes |
| <a name="input_location"></a> [location](#input\_location) | Resource location for Azure resources. | `string` | n/a | yes |
| <a name="input_project"></a> [project](#input\_project) | Project short name. | `string` | n/a | yes |
| <a name="input_tags"></a> [tags](#input\_tags) | Environment tags. | `map(string)` | n/a | yes |

## Outputs

No outputs.
<!-- END_TF_DOCS -->
<!-- textlint-enable -->
<!-- prettier-ignore-end -->
```

---

## Summary

Following these steps ensures your repository is properly configured with security features, branch protection, CI/CD pipelines, and documentation standards from the start.

<!-- textlint-enable -->
<!-- prettier-ignore-end -->
