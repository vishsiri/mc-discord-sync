# NestJS Doctor — Create Custom Rule

Generate custom nestjs-doctor rules that detect project-specific patterns and anti-patterns. Guides you through writing a valid rule file with ts-morph AST patterns, configuring the project, and verifying the rule loads.

## Usage

```bash
# After creating a rule, verify it loads:
npx nestjs-doctor@latest . --json
```

## Workflow

1. Describe the pattern to detect
2. Choose scope (file or project), category, and severity
3. Generate the rule file in the custom rules directory
4. Update nestjs-doctor config with `customRulesDir`
5. Run nestjs-doctor to verify the rule loads
