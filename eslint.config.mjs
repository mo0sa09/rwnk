import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // This project has no generated Supabase `Database` type (no
      // `supabase gen types typescript` output checked in), so every
      // service-role/anon client is intentionally created as `any` at the
      // boundary — see the comments on getAdminDb() and getSupabase(). Kept
      // as a warning (not silenced) rather than error so real regressions
      // in application logic aren't drowned out by ~70 pre-existing,
      // reviewed call sites of the same shape.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
]);

export default eslintConfig;
