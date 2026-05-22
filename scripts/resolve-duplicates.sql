-- Strategies to resolve duplicate category names
-- Choose ONE strategy based on your needs

-- STRATEGY 1: Keep the oldest category, delete newer duplicates
DELETE FROM blog_categories
WHERE id IN (
    SELECT id
    FROM (
        SELECT 
            id,
            ROW_NUMBER() OVER (PARTITION BY user_id, blog_category_name ORDER BY created_at ASC) as rn
        FROM blog_categories
        WHERE blog_category_name IS NOT NULL
            AND deleted_at IS NULL
    ) ranked
    WHERE rn > 1
);

-- STRATEGY 2: Keep the newest category, delete older duplicates
-- DELETE FROM blog_categories
-- WHERE id IN (
--     SELECT id
--     FROM (
--         SELECT 
--             id,
--             ROW_NUMBER() OVER (PARTITION BY user_id, blog_category_name ORDER BY created_at DESC) as rn
--         FROM blog_categories
--         WHERE blog_category_name IS NOT NULL
--             AND deleted_at IS NULL
--     ) ranked
--     WHERE rn > 1
-- );

-- STRATEGY 3: Rename duplicates by appending a timestamp
-- UPDATE blog_categories
-- SET blog_category_name = blog_category_name || ' (duplicate ' || EXTRACT(EPOCH FROM created_at) || ')'
-- WHERE id IN (
--     SELECT id
--     FROM (
--         SELECT 
--             id,
--             ROW_NUMBER() OVER (PARTITION BY user_id, blog_category_name ORDER BY created_at ASC) as rn
--         FROM blog_categories
--         WHERE blog_category_name IS NOT NULL
--             AND deleted_at IS NULL
--     ) ranked
--     WHERE rn > 1
-- );
