// import js from "@eslint/js";
// import globals from "globals";
import { defineConfig } from "eslint/config";


export default defineConfig([
  // { files: ["**/*.{js,mjs,cjs}"], plugins: { js }, extends: ["js/recommended"] },
  { files: ["src/*.{js,mjs,cjs}"], ignores: ["src/threex.rendererstats.js"], rules: {
    'semi': ['error', 'always'],
    'indent': ['error', 2],
  } },
]);