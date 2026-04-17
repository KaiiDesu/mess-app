// test-api.js - Quick API test script
const jwt = require('jsonwebtoken');

const SECRET = 'a67e93cb-17c1-4295-8389-bc582f5483da';

// Generate a test JWT
const token = jwt.sign(
  {
    sub: '550e8400-e29b-41d4-a716-446655440000',
    email: 'test@example.com'
  },
  SECRET,
  { expiresIn: '1h' }
);

console.log('Test JWT Token:');
console.log(token);
console.log('\nUse this token in the Authorization header:');
console.log(`Authorization: Bearer ${token}`);
