module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.spec.ts', '<rootDir>/test/**/*.spec.ts'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts'],
}
