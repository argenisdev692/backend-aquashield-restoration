-- ============================================================
--  bootstrap.sql — PRE-TABLES setup
--
--  Run BEFORE `npx prisma db push`:
--    npx prisma db execute --file prisma/bootstrap.sql --schema prisma/schema
--
--  Idempotent: safe to run multiple times.
--
--  Contents:
--    1. pgcrypto extension (needed by uuid_generate_v7 for gen_random_bytes)
--    2. uuid_generate_v7() function — referenced by Prisma's @default(dbgenerated)
--    3. trigger_set_updated_at() function — body shared by every BEFORE UPDATE trigger
--
--  Note: per-table triggers + partial indexes live in `prisma/post-tables.sql`
--  because they depend on the tables existing first.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------
--  uuid_generate_v7()
--
--  Generates a UUID v7 (RFC 9562): 48-bit ms timestamp + version + random.
--  Time-ordered → sequential B-tree inserts, no page fragmentation.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION uuid_generate_v7()
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  unix_ms bigint;
  buf     bytea;
  hex     text;
BEGIN
  unix_ms := floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint;
  buf     := gen_random_bytes(16);

  -- Overlay 48-bit timestamp into bytes 0–5
  buf := set_byte(buf, 0, ((unix_ms >> 40) & 255)::int);
  buf := set_byte(buf, 1, ((unix_ms >> 32) & 255)::int);
  buf := set_byte(buf, 2, ((unix_ms >> 24) & 255)::int);
  buf := set_byte(buf, 3, ((unix_ms >> 16) & 255)::int);
  buf := set_byte(buf, 4, ((unix_ms >> 8)  & 255)::int);
  buf := set_byte(buf, 5, ( unix_ms        & 255)::int);

  -- Set version = 7 (byte 6, high nibble: 0111)
  buf := set_byte(buf, 6, (get_byte(buf, 6) & 15) | 112);

  -- Set variant = 10xx (byte 8, high 2 bits: 10)
  buf := set_byte(buf, 8, (get_byte(buf, 8) & 63) | 128);

  hex := encode(buf, 'hex');

  RETURN (
    substring(hex FROM  1 FOR 8) || '-' ||
    substring(hex FROM  9 FOR 4) || '-' ||
    substring(hex FROM 13 FOR 4) || '-' ||
    substring(hex FROM 17 FOR 4) || '-' ||
    substring(hex FROM 21 FOR 12)
  )::uuid;
END;
$$;

-- ------------------------------------------------------------
--  trigger_set_updated_at()
--
--  Shared body for every BEFORE UPDATE trigger.
--  Prisma models intentionally do NOT use @updatedAt — the trigger owns it.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
