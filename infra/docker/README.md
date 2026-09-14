# Local infrastructure

`compose.yml` (parent folder) starts:

- PostgreSQL 16 — `localhost:5432` (user/pass/db: `pantrio`)
- Redis 7 — `localhost:6379`
- MinIO — API `9000`, console `9001` (bucket `pantrio-media`)

```bash
# from repo root (Docker Desktop must be running)
pnpm docker:up
pnpm docker:down
```
