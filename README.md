# search-logger

Tiny Node/Express API that logs search events to Heroku Postgres and exposes a CSV export.

## Endpoints
- `POST /v1/log-search` – ingest events.
- `GET /export.csv` – download CSV of all events.
- `GET /healthz` – health check.

## Env vars
- `DATABASE_URL` – provided by Heroku Postgres add-on.
- `WRITE_KEY` (or `TRACKING_SECRET`) – lightweight write token checked on ingest.
- `ALLOWED_ORIGIN` – e.g. `https://yourshopdomain` for CORS (use `*` to test).
- `NODE_ENV=production` recommended.
