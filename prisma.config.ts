import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // PRISMA_CLI_URL: explicit override (e.g. force the Accelerate HTTP URL
    // when direct TCP to the database is blocked)
    // DIRECT_DATABASE_URL: direct PostgreSQL for CLI (db push, migrate, studio)
    // DATABASE_URL: Prisma Accelerate for runtime (Next.js app + Vercel)
    url: process.env["PRISMA_CLI_URL"] ?? process.env["DIRECT_DATABASE_URL"] ?? process.env["DATABASE_URL"],
  },
});
