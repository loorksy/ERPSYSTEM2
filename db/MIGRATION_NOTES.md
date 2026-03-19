# Migration: SQLite → PostgreSQL

## Summary

The database layer now supports both SQLite (sql.js) and PostgreSQL. When `DATABASE_URL` is set, PostgreSQL is used. Otherwise, SQLite is used (fallback).

## Setup PostgreSQL

1. Create database and user:
```bash
sudo -u postgres psql -c "CREATE USER lork WITH PASSWORD '123456';"
sudo -u postgres psql -c "CREATE DATABASE lorkerp OWNER lork;"
```

2. Run schema:
```bash
psql postgresql://lork:123456@localhost:5432/lorkerp -f db/schema.pg.sql
```

3. Add to `.env`:
```
DATABASE_URL=postgresql://lork:123456@localhost:5432/lorkerp
```

## Changes Made

### db/database.js
- Added PostgreSQL (pg) support when DATABASE_URL is set
- Converts SQLite `?` placeholders to PostgreSQL `$1, $2, ...`
- Converts `INSERT OR REPLACE` to `INSERT ... ON CONFLICT ... DO UPDATE`
- All db methods (run, get, all) return Promises for consistency
- Falls back to SQLite if PostgreSQL init fails

### payrollSearchService.js
- All DB-accessing functions are now async: getCycleColumns, getCycleCache, saveCycleCache, saveUserAuditStatus, getUserAuditStatus

### cycleSyncWorker.js
- Uses await for all async calls
- Added DISABLE_BACKGROUND_SYNC=1 env var to disable worker
- Wrapped in try/catch to prevent crashes

### routes/auth.js
- Login route is async, uses await for db calls

## Remaining Updates (for full PostgreSQL support)

The following files still need `await` added for db calls when using PostgreSQL:
- routes/settings.js
- routes/sheet.js
- routes/search.js
- routes/sheets.js
- routes/shipping.js
- routes/dashboard.js
- routes/subAgencies.js
- services/agencySyncService.js
- services/aiService.js

Pattern: Change `const x = db.prepare(sql).get(params)` to `const x = await db.prepare(sql).get(params)` and ensure the route handler is `async (req, res) =>`.

## Stability

- DISABLE_BACKGROUND_SYNC=1: Disables cycleSyncWorker to prevent concurrent DB access issues
- SQLite fallback: If PostgreSQL fails, app falls back to SQLite
- No process.exit on DB query errors (only on init failure when both backends fail)
