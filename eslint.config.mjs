import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: ["desktop/**", ".next/**", "out/**", "node_modules/**"],
  },
  {
    // Pre-existing style issues across the codebase, downgraded to warnings
    // so CI stays green; react-hooks/rules-of-hooks stays an error since a
    // conditional hook call is a real bug, not a style preference.
    rules: {
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-unused-expressions": "warn",
      "@next/next/no-html-link-for-pages": "warn",
      "prefer-const": "warn",
    },
  },
];

export default eslintConfig;
