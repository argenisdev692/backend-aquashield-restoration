-- Check for duplicate emails in appointments table
-- Run this query in your database to identify duplicates before migration

SELECT 
    email,
    COUNT(*) as duplicate_count,
    ARRAY_AGG(id ORDER BY created_at) as appointment_ids,
    ARRAY_AGG(first_name ORDER BY created_at) as first_names,
    ARRAY_AGG(last_name ORDER BY created_at) as last_names,
    ARRAY_AGG(created_at ORDER BY created_at) as created_dates
FROM appointments
WHERE email IS NOT NULL
    AND deleted_at IS NULL
GROUP BY email
HAVING COUNT(*) > 1
ORDER BY email;

-- Total count of duplicate email groups
SELECT COUNT(*) as total_duplicate_email_groups
FROM (
    SELECT email
    FROM appointments
    WHERE email IS NOT NULL
        AND deleted_at IS NULL
    GROUP BY email
    HAVING COUNT(*) > 1
) AS duplicates;

-- Show all records with duplicate emails (for review)
SELECT 
    id,
    email,
    first_name,
    last_name,
    created_at,
    deleted_at
FROM appointments
WHERE email IS NOT NULL
    AND deleted_at IS NULL
    AND email IN (
        SELECT email
        FROM appointments
        WHERE email IS NOT NULL
            AND deleted_at IS NULL
        GROUP BY email
        HAVING COUNT(*) > 1
    )
ORDER BY email, created_at;
