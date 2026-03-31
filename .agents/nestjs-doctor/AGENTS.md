# NestJS Doctor

Diagnose and fix NestJS codebase health issues. Scans for security, performance, correctness, and architecture issues. Outputs a 0-100 score with actionable diagnostics.

## Usage

```bash
npx nestjs-doctor@latest . --verbose --json
```

## Workflow

Run after making changes to catch issues early. Fix errors first (security > correctness > architecture > performance), then re-run to verify the score improved.
