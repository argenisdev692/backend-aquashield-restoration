import { defineConfig } from 'orval';

export default defineConfig({
  api: {
    output: {
      mode: 'split',
      target: './frontend/src/api/generated.ts',
      schemas: './frontend/src/api/schemas',
      client: './frontend/src/api/client.ts',
      override: {
        mutator: './frontend/src/api/mutator.ts',
        query: {
          useQuery: true,
          useMutation: true,
          useInfinite: true,
          useInfiniteQueryParam: 'page',
          useInvalidate: true,
          shouldExportQueryKey: true,
          options: {
            staleTime: 10000, // 10 seconds
            retry: 1,
          },
          // Generic invalidation patterns - will be refined per module as needed
          mutationInvalidates: [
            {
              // Create operations invalidate list operations
              onMutations: [/^create/],
              invalidates: [/^list/],
            },
            {
              // Delete/Restore operations invalidate list and get operations
              onMutations: [/^(delete|restore)/],
              invalidates: [/^(list|get)/],
            },
            {
              // Update operations invalidate list and get operations
              onMutations: [/^(update|mark)/],
              invalidates: [/^(list|get)/],
            },
            {
              // Bulk operations invalidate list operations
              onMutations: [/^bulk/],
              invalidates: [/^list/],
            },
          ],
        },
      },
    },
    input: './openapi.json',
    hooks: {
      afterAllFilesWrite: 'prettier --write',
    },
  },
});
