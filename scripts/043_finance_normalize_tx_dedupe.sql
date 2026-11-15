BEGIN;

WITH candidates AS (
  SELECT
    id,
    owner_address,
    created_at,
    CASE
      WHEN metadata ? 'txHash' AND metadata->>'txHash' ~* '^0x[a-f0-9]{64}$'
        THEN 'tx:' || lower(metadata->>'txHash')
      WHEN dedupe_key ~ '^tx:.*:'
        THEN regexp_replace(dedupe_key, '^tx:.*:', 'tx:')
      ELSE dedupe_key
    END AS new_key
  FROM finance_transactions
),
ranked AS (
  SELECT
    id,
    owner_address,
    new_key,
    row_number() OVER (PARTITION BY owner_address, new_key ORDER BY created_at, id) AS rn
  FROM candidates
  WHERE new_key LIKE 'tx:%'
)
DELETE FROM finance_transactions ft
USING ranked r
WHERE ft.id = r.id AND r.rn > 1;

WITH candidates AS (
  SELECT
    id,
    CASE
      WHEN metadata ? 'txHash' AND metadata->>'txHash' ~* '^0x[a-f0-9]{64}$'
        THEN 'tx:' || lower(metadata->>'txHash')
      WHEN dedupe_key ~ '^tx:.*:'
        THEN regexp_replace(dedupe_key, '^tx:.*:', 'tx:')
      ELSE dedupe_key
    END AS new_key
  FROM finance_transactions
)
UPDATE finance_transactions ft
SET dedupe_key = c.new_key
FROM candidates c
WHERE ft.id = c.id AND c.new_key LIKE 'tx:%' AND ft.dedupe_key <> c.new_key;

COMMIT;
