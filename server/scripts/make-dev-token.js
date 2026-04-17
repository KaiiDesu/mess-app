require('dotenv').config();
const jwt = require('jsonwebtoken');

const userId = process.argv[2] || '550e8400-e29b-41d4-a716-446655440000';
const email = process.argv[3] || 'test@example.com';

if (!process.env.JWT_SECRET) {
  console.error('Missing JWT_SECRET in server/.env');
  process.exit(1);
}

const token = jwt.sign(
  {
    sub: userId,
    email
  },
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
);

console.log(token);
