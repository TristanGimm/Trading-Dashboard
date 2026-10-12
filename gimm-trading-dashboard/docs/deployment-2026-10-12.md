# Deployment — 12 October 2026

Deployed to the existing production Compose project at `/root/trading-dashboard/gimm-trading-dashboard`.

Changes: preserve Notion Win/Loss tags separately from financial results; show missing Net € in the dashboard, calendar and journal; compare recorded confluence outcomes; include dynamic TF Type comparisons (including 5s Type 3); import MFE(30 min) / MAE (30min), display separate averages, scatter plot, individual measurements and trade details, and export them in CSV.

The worker applies three additive, idempotent columns: recorded_outcome, mfe_30m and mae_30m. The first sync completed before the web restart. The existing database service and volume were retained.

Validation: 34 unit tests, TypeScript, production build and browser checks passed, including new analytics content and mobile overflow checks at 390/320px. Production health, authentication redirect, authenticated Analytics rendering and public HTTPS login passed. The worker successfully synchronized 115 records. Trades 113/114 contain recorded wins, Fractal Shift, 1m/5s Type 3 and excursion measurements; their Net € fields remain empty in Notion. Financial totals correctly await those amounts.

Rollback resources on the server: database backup `/root/trading-backups/trading-20261012T124439Z.sql.gz`, source archive `/root/trading-backups/source-before-20261012.tar.gz`, and images `gimm-trading-web:before-20261012` / `gimm-trading-worker:before-20261012`. The schema additions are compatible with the prior version.

Deployment transferred the changed source files directly; it did not publish a Git commit or push a branch.
