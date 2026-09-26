const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended');

module.exports = defineConfig([
  expoConfig,
  eslintPluginPrettierRecommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/tortie/ui/input.tsx'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react-native',
              importNames: ['TextInput'],
              allowTypeImports: true,
              message:
                'Use `Input` from @/tortie/ui/input so the focused field stays above the keyboard (see .cursor/rules/keyboard-fields.mdc).',
            },
          ],
        },
      ],
    },
  },
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '.expo/**',
      'coverage/**',
      'android/**',
      'ios/**',
    ],
  },
]);
