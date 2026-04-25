import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          // Allow test files outside ./src (the main tsconfig rootDir)
          rootDir: '.',
          module: 'CommonJS',
          esModuleInterop: true,
          strict: true,
          skipLibCheck: true,
          resolveJsonModule: true,
          // Explicitly include jest globals so test files can use describe/it/expect
          types: ['jest', 'node'],
        },
      },
    ],
  },
};

export default config;
