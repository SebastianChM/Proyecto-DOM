import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import react from "eslint-plugin-react";

export default tseslint.config(
    { ignores: ["**/node_modules/", "**/dist/", "**/.next/", "**/.dev/", "api/tools/"] },
    {
        extends: [js.configs.recommended, ...tseslint.configs.recommended],
        files: ["**/*.ts", "**/*.tsx", "scripts/**/*.js"],
        languageOptions: {
            ecmaVersion: 2020,
            globals: {
                ...globals.browser,
                ...globals.node
            }
        },
        plugins: {
            "react": react,
            "react-hooks": reactHooks
        },
        rules: {
            "@typescript-eslint/no-explicit-any": "warn",
            "@typescript-eslint/no-unused-vars": "warn",
            "no-undef": "off",
            ...reactHooks.configs.recommended.rules
        }
    },
    {
        files: ["scripts/**/*.js"],
        rules: {
            "@typescript-eslint/no-var-requires": "off",
            "@typescript-eslint/no-require-imports": "off",
            "no-undef": "off"
        }
    }
);
