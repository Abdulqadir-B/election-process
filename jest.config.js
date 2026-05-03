const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.mjs and .env files in tests
  dir: './',
});

/** @type {import('jest').Config} */
const config = {
  coverageProvider: 'v8',
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // Map module aliases and redirect problematic GCP packages to manual mocks
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@google-cloud/logging$': '<rootDir>/__mocks__/@google-cloud/logging.js',
  },
  // Coverage collection config
  collectCoverageFrom: [
    'app/**/*.{ts,tsx}',
    '!app/**/*.d.ts',
    '!app/layout.tsx',
  ],
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)',
  ],
};

module.exports = createJestConfig(config);
