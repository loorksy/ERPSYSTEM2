# Migration: SQLite → PostgreSQL (مكتمل)

## Summary

تم الانتقال بالكامل من SQLite إلى PostgreSQL. قاعدة البيانات تعتمد حصرياً على PostgreSQL ولا يوجد أي fallback لـ SQLite.

يجب تعيين متغير البيئة `DATABASE_URL` لتشغيل التطبيق.

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
- PostgreSQL only — no SQLite fallback
- API: `getDb().query(sql, params)` with native `$1, $2, ...` placeholders
- Auto `RETURNING id` on INSERT statements
- Transaction support via `runTransaction(callback)`
- Auto-migration for schema and admin user on startup

### payrollSearchService.js
- All DB-accessing functions are async with `await`

### cycleSyncWorker.js
- Uses `await` for all async calls
- `DISABLE_BACKGROUND_SYNC=1` env var to disable worker
- Wrapped in try/catch to prevent crashes

### routes/auth.js
- Login route is async, uses `await` for db calls
