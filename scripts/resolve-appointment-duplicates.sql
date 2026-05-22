-- Resolve duplicate emails in appointments table
-- This script keeps the oldest record (by created_at) and soft-deletes the newer duplicates
-- Run this AFTER reviewing the duplicates with check-appointment-duplicates.sql

BEGIN;

-- Create a temporary table to track which records to keep
CREATE TEMP TABLE appointments_to_keep AS
SELECT 
    MIN(id) as id_to_keep,
    email
FROM appointments
WHERE email IS NOT NULL
    AND deleted_at IS NULL
GROUP BY email;

-- Soft-delete duplicate records (keep the oldest, delete the rest)
UPDATE appointments
SET deleted_at = NOW()
WHERE email IS NOT NULL
    AND deleted_at IS NULL
    AND id NOT IN (SELECT id_to_keep FROM appointments_to_keep);

-- Show how many duplicates were resolved
SELECT 
    COUNT(*) as duplicates_resolved
FROM appointments
WHERE deleted_at IS NOT NULL
    AND email IN (SELECT email FROM appointments_to_keep);

COMMIT;

-- Verification query - check if any duplicates remain
SELECT 
    email,
    COUNT(*) as remaining_count
FROM appointments
WHERE email IS NOT NULL
    AND deleted_at IS NULL
GROUP BY email
HAVING COUNT(*) > 1;
