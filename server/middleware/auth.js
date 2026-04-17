// server/middleware/auth.js - JWT verification middleware
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({
      code: 'AUTH_FAILED',
      message: 'Missing authorization token'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    logger.error('Token verification failed', { error: err.message });
    return res.status(401).json({
      code: 'AUTH_FAILED',
      message: 'Invalid or expired token'
    });
  }
};

const verifySocketToken = (token, callback) => {
  if (!token) {
    return callback(new Error('Missing token'), false);
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded?.sub) {
      return callback(new Error('Missing sub claim'), false);
    }
    callback(null, decoded);
  } catch (err) {
    logger.error('Socket token verification failed', { error: err.message });
    callback(err, false);
  }
};

module.exports = {
  verifyToken,
  verifySocketToken
};
