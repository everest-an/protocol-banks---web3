/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx',
    '**/lib/**/*.test.ts',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  collectCoverageFrom: [
    'lib/**/*.ts',
    'app/api/**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
    '^.+\\.jsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
  transformIgnorePatterns: [
    'node_modules/.pnpm/(?!(uuid|winston|logform|triple-beam|@colors|readable-stream|string_decoder|safe-stable-stringify|fecha|fn\\.name|one-time|stack-trace|is-stream)@)',
    'node_modules/(?!(\\.pnpm|uuid|winston|logform|triple-beam|@colors|readable-stream|string_decoder|safe-stable-stringify|fecha|fn\\.name|one-time|stack-trace|is-stream))',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/.claude/worktrees/',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testTimeout: 30000,
  verbose: true,
};

module.exports = config;
