# Database migrations

`database/init/*.sql` runs **only on a fresh database** (Docker mounts it into
`/docker-entrypoint-initdb.d`, which MySQL executes only when the data volume is
empty). Any schema change to those files therefore does **not** reach an already
-running database.

For an existing/running DB, apply the dated migrations here **in filename order**.
They are written to be idempotent (safe to re-run).

## Apply a migration (Docker)

```bash
# From the project root, with the stack running:
docker compose exec -T voc-db \
  mysql -u root -p"$MYSQL_ROOT_PASSWORD" voc_system \
  < database/migrations/2026-07-01_01_condition_state_damaged.sql
```

Replace `voc_system` if you set a non-default `DB_NAME`.

## Apply a migration (direct mysql client)

```bash
mysql -h <host> -P <port> -u root -p voc_system \
  < database/migrations/2026-07-01_01_condition_state_damaged.sql
```

## Log

| File | Date | Purpose |
|------|------|---------|
| `2026-07-01_01_condition_state_damaged.sql` | 2026-07-01 | Add `'damaged'` to `device_history.condition_state` (C-2 fix) |
| `2026-07-01_02_device_purchase_fields.sql` | 2026-07-01 | Add procurement fields to `devices` (supplier, purchase_cost, currency, po_number, invoice_no) |
