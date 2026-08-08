// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    // `load-tests/k6/**`: scripts standalone para el binario de k6 (Fase 15,
    // Bloque D), no para Node/tsc — usan globals propios de k6 (`__ENV`,
    // etc.) que este proyecto de ESLint (pensado para el backend Node) no
    // conoce, y no forman parte del build ni del typecheck del backend.
    ignores: [
      'dist/**',
      'node_modules/**',
      'logs/**',
      'backups/**',
      'coverage/**',
      'load-tests/k6/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      'no-console': 'warn',
    },
  },
  prettier,
);
