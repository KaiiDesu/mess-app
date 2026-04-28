// server/middleware/auth.js - JWT verification middleware
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');
const logger = require('../utils/logger');

const verifyToken = async (req, res, next) => {
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

    // Check if user is banned (gracefully handle if columns don't exist)
    try {
      const { data: users, error: userError } = await supabase
        .from('users')
        .select('id, is_banned, ban_reason')
        .eq('auth_id', decoded.sub)
        .limit(1);

      if (!userError && users && users.length > 0) {
        const user = users[0];
        if (user.is_banned) {
          logger.warn(`Banned user login attempt: ${decoded.sub}`, { 
            reason: user.ban_reason 
          });
          return res.status(403).json({
            code: 'ACCOUNT_BANNED',
            message: user.ban_reason || 'Your account has been suspended',
            isBanned: true
          });
        }
      }
    } catch (banCheckErr) {
      // If ban check fails (e.g., columns don't exist yet), continue anyway
      logger.debug('Ban check skipped', { error: banCheckErr.message });
    }

    next();
  } catch (err) {
    logger.error('Token verification failed', { error: err.message });
    return res.status(401).json({
      code: 'AUTH_FAILED',
      message: 'Invalid or expired token'
    });
  }
};

const verifySocketToken = async (token, callback) => {
  if (!token) {
    return callback(new Error('Missing token'), false);
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded?.sub) {
      return callback(new Error('Missing sub claim'), false);
    }

    // Check if user is banned (gracefully handle if columns don't exist)
    try {
      const { data: users, error: userError } = await supabase
        .from('users')
        .select('id, is_banned, ban_reason')
        .eq('auth_id', decoded.sub)
        .limit(1);

      if (!userError && users && users.length > 0) {
        const user = users[0];
        if (user.is_banned) {
          logger.warn(`Banned user socket attempt: ${decoded.sub}`, { 
            reason: user.ban_reason 
          });
          return callback(new Error('ACCOUNT_BANNED:' + (user.ban_reason || 'Your account has been suspended')), false);
        }
      }
    } catch (banCheckErr) {
      // If ban check fails (e.g., columns don't exist yet), continue anyway
      logger.debug('Socket ban check skipped', { error: banCheckErr.message });
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
