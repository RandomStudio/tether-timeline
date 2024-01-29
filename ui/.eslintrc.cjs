module.exports = {
  rules: {
    // Note: you must disable the base rule as it can report incorrect errors
    "no-use-before-define": "off",
    // "@typescript-eslint/no-use-before-define": "error",
		// note you must disable the base rule
    // as it can report incorrect errors
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": [
      "warn", // or "error"
      {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
        "caughtErrorsIgnorePattern": "^_"
      }
    ]
  },
	extends: [
		"plugin:@typescript-eslint/recommended",
    "plugin:react-hooks/recommended"
  ],
	env: {
		browser: true,
		es2020: true,
		es6: true,
		node: true,
	},
	parser: '@typescript-eslint/parser',
	parserOptions: {
		ecmaFeatures: {
			jsx: true,
		},
		ecmaVersion: 9,
		requireConfigFile: false,
		sourceType: 'module',
	},
	plugins: ['react-hooks', '@typescript-eslint'],
	settings: {
		'import/resolver': {
			node: {
				extensions: ['.js', '.jsx', '.ts', '.tsx'],
				paths: ['.'],
			},
		},
		react: {
			pragma: 'React',
			version: 'detect',
		},
	},
};
