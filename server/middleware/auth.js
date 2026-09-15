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

    // Check if user is banned (with timeout to prevent blocking)
    let banCheckCompleted = false;
    const banCheckTimeout = setTimeout(() => {
      if (!banCheckCompleted) {
        logger.debug('HTTP ban check timeout - allowing request anyway');
      }
    }, 2000);

    try {
      const { data: users, error: userError } = await supabase
        .from('users')
        .select('is_banned, ban_reason')
        .eq('auth_id', decoded.sub)
        .limit(1);

      banCheckCompleted = true;
      clearTimeout(banCheckTimeout);

      if (!userError && users && users.length > 0) {
        const user = users[0];
        if (user.is_banned === true) {
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
      clearTimeout(banCheckTimeout);
      // If ban check fails, log and continue
      logger.debug('HTTP ban check error - allowing request anyway', { 
        error: banCheckErr.message 
      });
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

    // Check if user is banned with timeout (don't block socket connection)
    let banCheckCompleted = false;
    const banCheckTimeout = setTimeout(() => {
      if (!banCheckCompleted) {
        logger.debug('Socket ban check timeout - continuing anyway');
      }
    }, 2000);

    try {
      const { data: users, error: userError } = await supabase
        .from('users')
        .select('is_banned, ban_reason')
        .eq('auth_id', decoded.sub)
        .limit(1);

      banCheckCompleted = true;
      clearTimeout(banCheckTimeout);

      if (!userError && users && users.length > 0) {
        const user = users[0];
        if (user.is_banned === true) {
          logger.warn(`Banned user socket attempt: ${decoded.sub}`, { 
            reason: user.ban_reason 
          });
          return callback(new Error('ACCOUNT_BANNED:' + (user.ban_reason || 'Your account has been suspended')), false);
        }
      }
    } catch (banCheckErr) {
      clearTimeout(banCheckTimeout);
      // If ban check fails, just log and continue
      logger.debug('Socket ban check error - continuing anyway', { 
        error: banCheckErr.message
      });
    }

    callback(null, decoded);
  } catch (err) {
    logger.error('Socket token verification failed', { error: err.message });
    callback(err, false);
  }
};

const getSuperAdminEmails = () => {
  return String(process.env.SUPER_ADMIN_EMAILS || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
};

const requireSuperAdmin = async (req, res, next) => {
  try {
    const userId = req.user?.sub;

    if (!userId) {
      return res.status(401).json({
        code: 'AUTH_FAILED',
        message: 'Missing authenticated user context'
      });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return res.status(403).json({
        code: 'FORBIDDEN',
        message: 'Admin access denied'
      });
    }

    const allowedEmails = getSuperAdminEmails();
    const userEmail = String(user.email || '').toLowerCase();

    if (!allowedEmails.includes(userEmail)) {
      logger.warn('Super admin access denied', { userId, userEmail });
      return res.status(403).json({
        code: 'FORBIDDEN',
        message: 'Super admin access required'
      });
    }

    req.adminUser = user;
    next();
  } catch (err) {
    logger.error('Super admin authorization failed', { error: err.message });
    return res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to authorize super admin'
    });
  }
};

module.exports = {
  verifyToken,
  verifySocketToken,
  requireSuperAdmin
};
