module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts'],
  coverageDirectory: 'coverage',
  verbose: true,
  // chalk@5+ is pure ESM. ts-jest compiles TS to CJS, so chalk's `import` syntax
  // throws SyntaxError. Map chalk to a tiny identity shim — pipeline tests
  // verify behavior, not color output.
  moduleNameMapper: {
    '^chalk$': '<rootDir>/test/__mocks__/chalk.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(chalk|#ansi-styles)/)',
  ],
};
