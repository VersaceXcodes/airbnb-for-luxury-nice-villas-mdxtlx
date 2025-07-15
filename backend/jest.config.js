module.exports = {
  "preset": "ts-jest",
  "testEnvironment": "node",
  "setupFilesAfterEnv": [
    "<rootDir>/tests/setup.ts"
  ],
  "collectCoverage": true,
  "coverageReporters": [
    "text",
    "lcov",
    "json"
  ],
  "coverageDirectory": "coverage",
  "coverageThreshold": {
    "global": {
      "branches": 80,
      "functions": 80,
      "lines": 80,
      "statements": 80
    }
  },
  "globalSetup": "<rootDir>/tests/globalSetup.ts",
  "globalTeardown": "<rootDir>/tests/globalTeardown.ts"
};