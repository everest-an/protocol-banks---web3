import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"

/**
 * Lint policy:
 * - Real bugs stay at error level (rules-of-hooks, prefer-const, unused vars, ...)
 * - Legacy-debt rules (pre-React-Compiler patterns, explicit any, require imports)
 *   are downgraded to warnings so CI lint is actionable without rewriting
 *   100k+ lines of pre-existing code in one pass.
 */
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Legacy debt — warn, don't block
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "react/no-unescaped-entities": "warn",
      // React Compiler rules — project does not use the compiler yet
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/static-components": "warn",
      // Keep real issues at error level
      "react-hooks/rules-of-hooks": "error",
      "prefer-const": "error",
      "@next/next/no-html-link-for-pages": "error",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "node_modules/**",
    ".data/**",
    "test-results/**",
    "playwright-report/**",
    "AlphaGPT/**",
    "services/**",
    "public/**",
    "next-env.d.ts",
    "*.config.js",
    "*.config.mjs",
  ]),
])

export default eslintConfig
