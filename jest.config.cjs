/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.(test|spec).js'],
  clearMocks: true,
  verbose: true,
  // setupFiles: ['<rootDir>/jest.setup.js']
};
