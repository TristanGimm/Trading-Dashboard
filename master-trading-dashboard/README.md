# GIMM Trading Dashboard

Next.js application, PostgreSQL schema and Docker configuration for the private trading journal and workspace.

The [main project README](../README.md) explains the architecture, journaling workflow, setup, authentication, uploads, checks and backups.

## Local demo

Requires Node.js 22.18 or newer. Run from this directory:

```sh
npm ci
npm run preview
```

Open the address printed in the terminal. Demo login: `preview` / `gimm-local-preview-only`. The preview uses synthetic trades and never connects to PostgreSQL.

## Checks

```sh
npm run typecheck
npm test
npm run build
npm run test:smoke
npm run test:browser -- --built
```
