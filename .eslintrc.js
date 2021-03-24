module.exports = {
	env: {
		browser: false,
		es6: true,
		node: true
	},
	parser: '@typescript-eslint/parser',
	parserOptions: {
		project: 'tsconfig.json',
		sourceType: 'module'
	},
	plugins: ['@typescript-eslint', 'jest'],
	extends: [
		'eslint:recommended',
		'plugin:@typescript-eslint/eslint-recommended',
		'plugin:@typescript-eslint/recommended',
		'plugin:jest/recommended',
		'prettier',
		'prettier/@typescript-eslint'
	],
	rules: {
		'linebreak-style': ['error', 'unix'],
		'@typescript-eslint/no-explicit-any': 'off',
		'@typescript-eslint/no-var-requires': 1,
		indent: [
			'error',
			'tab',
			{
				SwitchCase: 1,
				FunctionDeclaration: { body: 1, parameters: 1 },
				ignoredNodes: ['TemplateLiteral']
			}
		],
		quotes: ['error', 'single', { avoidEscape: true, allowTemplateLiterals: false }]
	}
};
