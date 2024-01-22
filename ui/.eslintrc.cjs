module.exports = {
  "rules": {
    // Note: you must disable the base rule as it can report incorrect errors
    "no-use-before-define": "off",
    "@typescript-eslint/no-use-before-define": "error"
  },
	"extends": [
    "plugin:react-hooks/recommended"
  ]
};
