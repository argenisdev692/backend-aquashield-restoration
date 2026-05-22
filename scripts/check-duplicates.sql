-- Check for duplicate category names per user
-- Run this query in your database to identify duplicates before migration

SELECT 
    user_id,
    blog_category_name,
    COUNT(*) as duplicate_count,
    ARRAY_AGG(id ORDER BY created_at) as category_ids,
    ARRAY_AGG(created_at ORDER BY created_at) as created_dates
FROM blog_categories
WHERE blog_category_name IS NOT NULL
    AND deleted_at IS NULL
GROUP BY user_id, blog_category_name
HAVING COUNT(*) > 1
ORDER BY user_id, blog_category_name;

-- Total count of duplicates
SELECT COUNT(*) as total_duplicate_groups
FROM (
    SELECT user_id, blog_category_name
    FROM blog_categories
    WHERE blog_category_name IS NOT NULL
        AND deleted_at IS NULL
    GROUP BY user_id, blog_category_name
    HAVING COUNT(*) > 1
) AS duplicates;
