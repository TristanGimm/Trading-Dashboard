# GIMM Trading Dashboard

This directory contains the Next.js application, Notion synchronization worker and Docker configuration for my personal trading dashboard.

The [main project README](../README.md) explains the motivation, architecture, data flow, performance calculations and setup.

## Local demo

Requires Node.js 22.18 or newer. Run from this directory:

```sh
npm ci
npm run preview
```

Open the address printed in the terminal. Demo login: `preview` / `gimm-local-preview-only`. The preview uses synthetic trades without loading private environment files or connecting to Notion or PostgreSQL.

## Documentation

- [Authentication and session configuration](docs/authentication.md)
- [Local preview and browser checks](docs/local-preview.md)
- [Deployment preparation](docs/deployment-checklist.md)

## Checks

```sh
npm run typecheck
npm test
npm run build
npm run test:smoke
```
