/**
 * Jest configuration for timezone contract tests
 */

const nextJest = require("next/jest");

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: "./",
});

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  testEnvironment: "node",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^@utils/(.*)$": "<rootDir>/utils/$1",
    "^@config/(.*)$": "<rootDir>/config/$1",
    "^@locales/(.*)$": "<rootDir>/locales/$1",
    "^@models/(.*)$": "<rootDir>/models/$1",
    "^@app/(.*)$": "<rootDir>/app/$1",
    "^@domain/(.*)$": "<rootDir>/domain/$1",
    "^@lib/(.*)$": "<rootDir>/lib/$1",
  },
  testMatch: ["**/__tests__/**/*.test.js", "**/__tests__/**/*.test.ts"],
  collectCoverageFrom: [
    "utils/athensTime.js",
    "utils/analyzeOrderTimeConflicts.js",
  ],
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig);
