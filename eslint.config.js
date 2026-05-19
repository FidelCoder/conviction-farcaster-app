import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import prettier from "eslint-config-prettier";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    ignores: [".next/", "coverage/", "dist/", "next-env.d.ts", "node_modules/", "out/"],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  prettier,
];

export default eslintConfig;
