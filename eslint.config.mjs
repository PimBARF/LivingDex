export default [
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
    rules: {
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "no-undef": "off",
      "no-constant-condition": "warn",
      "no-prototype-builtins": "off",
    },
  },
  {
    ignores: [
      "**/node_modules/**",
      "**/.cache/**",
      "**/assets/**",
      "**/data/**",
    ],
  },
];
