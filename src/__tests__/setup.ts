// Test setup file
// Mock environment variables
process.env['NODE_ENV'] = 'test';
process.env['JWT_SECRET'] = 'test-jwt-secret';
process.env['DATABASE_URL'] =
  'postgresql://test:test@localhost:5433/cedipay_test?schema=public';

// Simple test to satisfy Jest requirement
test('setup file loaded', () => {
  expect(true).toBe(true);
});
