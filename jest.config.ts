export default {
  roots: ['./src'],
  testMatch: ['**/__tests__/**/*.+(ts|tsx|js)', '**/?(*.)+(spec|test).+(ts|tsx|js)'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  moduleNameMapper: {
    '^uuid$': '<rootDir>/src/__mocks__/uuid.ts',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
