// Prisma 7 CLI configuration.
// Multi-file schema lives under `prisma/schema/` — every `*.prisma` file
// in that folder is composed at CLI time (validate, generate, db push, migrate).
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

type Env = {
  DATABASE_URL: string;
};

export default defineConfig({
  schema: "prisma/schema",
  migrations: {
    path: "prisma/migrations",
    // tsx handles both CJS and ESM TypeScript transparently — required because
    // Prisma 7's prisma-client generator emits ESM (import.meta.url, .js paths),
    // which ts-node + module:nodenext cannot run without extra config.
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env<Env>("DATABASE_URL"),
  },
});
