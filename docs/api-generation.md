# API Generation - TypeScript Types & Endpoints

Automated generation of TypeScript types and API endpoints from backend OpenAPI specification using Orval.

## Overview

This setup eliminates manual copying of DTOs and endpoint definitions from Swagger to the frontend. The backend OpenAPI spec is automatically converted into:
- TypeScript types for all DTOs
- React Query hooks for API calls
- Axios client with auth headers

## Installation

Dependencies are already installed:
```bash
npm install --save-dev orval
```

## Available Scripts

```bash
npm run api:export      # Export OpenAPI spec from backend
npm run api:generate    # Generate frontend types and endpoints
npm run api:sync        # Run both export and generate
```

## Workflow

1. **Modify backend** - Add/modify endpoints, DTOs, or controllers
2. **Generate code** - Run `npm run api:sync`
3. **Use in frontend** - Import generated types and hooks

## File Structure

```
backend/
├── scripts/
│   └── export-openapi.mjs    # Exports OpenAPI spec
├── orval.config.mjs           # Orval configuration
├── openapi.json               # Generated OpenAPI spec
└── frontend/src/api/
    ├── generated.ts           # Generated API hooks
    ├── schemas/               # Generated TypeScript types
    ├── client.ts              # Axios client
    ├── mutator.ts             # Request mutator (auth headers)
    └── README.md              # Usage documentation
```

## Configuration

Edit `orval.config.mjs` to customize:

```javascript
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
          useInfinite: true,
          useInfiniteQueryParam: 'page',
        },
      },
    },
    input: './openapi.json',
    hooks: {
      afterAllFilesWrite: 'prettier --write',
    },
  },
});
```

### Options

- **mode: 'split'** - Separates schemas and API functions
- **target** - Output file for API hooks
- **schemas** - Directory for TypeScript types
- **client** - Custom Axios client
- **mutator** - Function to modify requests (add auth headers)
- **useInfinite** - Enable infinite query for paginated endpoints
- **useInfiniteQueryParam** - Query param for pagination

## Usage Example

```typescript
import { 
  useContactSupport, 
  useCreateContactSupport,
  useDeleteContactSupport 
} from './api/generated';
import type { CreateContactSupportDto } from './api/schemas';

// Get list with pagination
function ContactSupportList() {
  const { data, isLoading, error } = useContactSupport({
    page: 1,
    limit: 10,
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading data</div>;

  return (
    <ul>
      {data?.items?.map(item => (
        <li key={item.id}>{item.firstName} {item.lastName}</li>
      ))}
    </ul>
  );
}

// Create new contact support
function CreateContactSupportForm() {
  const createMutation = useCreateContactSupport();

  const handleSubmit = (data: CreateContactSupportDto) => {
    createMutation.mutate(data, {
      onSuccess: () => {
        console.log('Created successfully');
      },
    });
  };

  return <form onSubmit={handleSubmit}>{/* form fields */}</form>;
}

// Delete contact support
function DeleteButton({ id }: { id: string }) {
  const deleteMutation = useDeleteContactSupport();

  return (
    <button 
      onClick={() => deleteMutation.mutate({ id })}
      disabled={deleteMutation.isPending}
    >
      Delete
    </button>
  );
}
```

## Customizing the Mutator

The mutator in `frontend/src/api/mutator.ts` adds authentication headers:

```typescript
import type { AxiosRequestConfig } from 'axios';

export const axiosMutator = async (config: AxiosRequestConfig) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`,
    };
  }
  return config;
};
```

Customize this to:
- Add custom headers
- Transform request data
- Handle refresh tokens
- Add request logging

## Customizing the Client

The Axios client in `frontend/src/api/client.ts` handles:

```typescript
import axios from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1',
  timeout: 30000,
});

// Add interceptors for logging, error handling, etc.
```

## Backend OpenAPI Export

The script `scripts/export-openapi.mjs` exports the OpenAPI spec:

```javascript
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'fs';
import { AppModule } from '../src/app.module';

async function exportOpenApi() {
  const app = await NestFactory.create(AppModule);
  const config = new SwaggerModule().createDocument(app, {
    title: 'Aquashield Restoration LLC API',
    description: 'REST API — OpenAPI 3.0',
    version: '1.0',
    addBearerAuth: true,
  });

  const outputPath = './openapi.json';
  writeFileSync(outputPath, JSON.stringify(config, null, 2));
  console.log(`OpenAPI spec exported to ${outputPath}`);
  await app.close();
}

exportOpenApi().catch(console.error);
```

## Best Practices

1. **Run `npm run api:sync` after backend changes** - Keep frontend in sync
2. **Commit generated files** - Include `openapi.json` and generated types in git
3. **Customize mutator for auth** - Ensure tokens are added to requests
4. **Use generated types** - Avoid manual type definitions
5. **Review generated code** - Check for any issues before committing

## Troubleshooting

### Generated types are incorrect
- Ensure backend Swagger decorators are correct
- Check that `npm run api:export` ran successfully
- Verify `openapi.json` contains the expected schema

### Auth headers not being sent
- Check `mutator.ts` is correctly implemented
- Verify token is available in localStorage
- Check browser console for errors

### Infinite query not working
- Ensure `useInfinite: true` in orval config
- Check that pagination params match backend expectations
- Verify backend returns pagination metadata

## References

- [Orval Documentation](https://orval.dev/)
- [OpenAPI Specification](https://swagger.io/specification/)
- [React Query Documentation](https://tanstack.com/query/latest)
