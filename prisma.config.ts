import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // DIRECT_DATABASE_URL: direct PostgreSQL for CLI (db push, migrate, studio)
    // DATABASE_URL: Prisma Accelerate for runtime (Next.js app + Vercel)
    url: process.env["DIRECT_DATABASE_URL"] ?? process.env["DATABASE_URL"],
  },
});
