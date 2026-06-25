// Standalone flat ESLint config for the Mirror Abyss memory-core repo.
// Deliberately framework-free (no Next/React presets): this is a plain
// TypeScript library + runnable examples. The third CI gate (alongside
// `tsc --noEmit` and `vitest run`) is `eslint`, as promised in CONTRIBUTING.md.
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/.vite/**',
      '**/*.tsbuildinfo',
      'examples/.ma1-demo-data/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      // Library code intentionally exposes flexible interop points; explicit
      // `any` is reviewed in PRs, not banned wholesale.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
);
