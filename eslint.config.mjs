import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
export default tseslint.config(
 {ignores:['dist/**','node_modules/**','worker/vendor/libsodium/*.mjs']},
 js.configs.recommended,
 {rules:{'no-empty':['error',{allowEmptyCatch:true}]}},
 ...tseslint.configs.recommended,
 {files:['src/**/*.{ts,tsx}','vite.config.ts'],languageOptions:{globals:{...globals.browser}},rules:{
  // Existing validated API payloads use any. Tighten these as their schemas gain types.
  '@typescript-eslint/no-explicit-any':'off',
  '@typescript-eslint/no-unused-vars':['error',{argsIgnorePattern:'^_',varsIgnorePattern:'^_',ignoreRestSiblings:true}],
 }},
 {files:['scripts/**/*.mjs','tests/**/*.mjs','*.mjs'],languageOptions:{globals:globals.node}},
 {files:['scripts/*test.mjs','scripts/map-preview.mjs'],languageOptions:{globals:globals.browser}},
 {files:['worker/**/*.ts'],languageOptions:{globals:{...globals.worker,DurableObjectNamespace:'readonly',Fetcher:'readonly'}},rules:{'@typescript-eslint/no-explicit-any':'off','@typescript-eslint/no-unused-vars':['error',{argsIgnorePattern:'^_',varsIgnorePattern:'^_',ignoreRestSiblings:true}]}},
);
