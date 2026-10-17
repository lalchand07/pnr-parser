import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'playground/dist', 'node_modules', 'coverage', 'src/enrich/data'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    // The core must stay browser-safe.
    files: ['src/**/*.ts'],
    ignores: ['src/cli.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['node:*', 'fs', 'path', 'os', 'process'],
              message: 'The core must not use Node-only APIs.',
            },
          ],
        },
      ],
      'no-restricted-globals': ['error', 'process', 'Buffer', 'require', '__dirname'],
    },
  },
);
