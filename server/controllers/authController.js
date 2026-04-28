// server/controllers/authController.js - Authentication logic
const supabase = require('../config/supabase');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { v4: uuid } = require('uuid');
const logger = require('../utils/logger');

const register = async (req, res) => {
  try {
    const { email, password, displayName, username, phone } = req.body;

    // Validate input
    if (!email || !password || !displayName) {
      return res.status(400).json({
        code: 'INVALID_INPUT',
        message: 'Email, password, and displayName required'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        code: 'WEAK_PASSWORD',
        message: 'Password must be at least 8 characters'
      });
    }

    // Create Supabase auth user without sending verification email.
    // This avoids Supabase email signup rate limits during local testing.
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: displayName,
        username,
        phone
      }
    });

    if (authError) {
      logger.error('Auth signup error', { error: authError.message });
      return res.status(400).json({
        code: 'SIGNUP_FAILED',
        message: authError.message
      });
    }

    const authUserId = authData.user?.id;

    if (!authUserId) {
      return res.status(500).json({
        code: 'SIGNUP_FAILED',
        message: 'Auth user was not created'
      });
    }

    const fallbackUsername = (email || '')
      .split('@')[0]
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 50);

    const safeUsername = (username || fallbackUsername || `user_${authUserId.slice(0, 8)}`)
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 50);

    // Create user profile
    // Insert profile row. Use `.select()` (returns array) and handle RLS/permission errors
    const { data: userRows, error: profileError } = await supabase
      .from('users')
      .insert({
        auth_id: authUserId,
        email,
        phone: phone || null,
        username: safeUsername,
        display_name: displayName,
        avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`,
        is_active: true
      })
      .select();

    if (profileError) {
      logger.error('Profile creation error', { error: profileError.message });

      // Common cause: RLS (row-level security) blocks inserts when using anon key.
      if (String(profileError.message || '').toLowerCase().includes('row-level')) {
        return res.status(500).json({
          code: 'RLS_VIOLATION',
          message:
            'Failed to create profile due to row-level security policy. Ensure the server has a valid SUPABASE_SERVICE_ROLE_KEY or adjust your RLS policies.'
        });
      }

      return res.status(500).json({
        code: 'PROFILE_CREATION_FAILED',
        message: 'Failed to create user profile'
      });
    }

    const user = Array.isArray(userRows) ? userRows[0] : userRows;

    if (!user) {
      logger.error('Profile creation returned no rows', { userRows });
      return res.status(500).json({
        code: 'PROFILE_CREATION_FAILED',
        message: 'Failed to create user profile'
      });
    }

    // Generate JWT
    const token = jwt.sign(
      { sub: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    logger.info('User registered', { userId: user.id, email });

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.display_name,
        avatarUrl: user.avatar_url
      },
      token
    });
  } catch (err) {
    logger.error('Register error', { error: err.message });
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Registration failed'
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        code: 'INVALID_INPUT',
        message: 'Email and password required'
      });
    }

    // Authenticate with Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError) {
      logger.warn('Login failed', { email, error: authError.message });
      return res.status(401).json({
        code: 'AUTH_FAILED',
        message: 'Invalid email or password'
      });
    }

    // Get user profile
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', authData.user.id)
      .single();

    if (userError || !user) {
      return res.status(500).json({
        code: 'USER_NOT_FOUND',
        message: 'User profile not found'
      });
    }

    // Generate custom JWT (Supabase also provides one, but we'll use our own)
    const token = jwt.sign(
      { sub: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Update last_login
    await supabase
      .from('users')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', user.id);

    logger.info('User logged in', { userId: user.id, email });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        status: user.status_message || ''
      },
      token
    });
  } catch (err) {
    logger.error('Login error', { error: err.message });
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Login failed'
    });
  }
};

const refreshToken = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        code: 'INVALID_INPUT',
        message: 'Token required'
      });
    }

    // Verify old token (even if expired)
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      // Try with ignoring expiration
      decoded = jwt.decode(token);
      if (!decoded) {
        return res.status(401).json({
          code: 'INVALID_TOKEN',
          message: 'Invalid token'
        });
      }
    }

    // Issue new token
    const newToken = jwt.sign(
      { sub: decoded.sub, email: decoded.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    logger.info('Token refreshed', { userId: decoded.sub });

    res.json({ token: newToken });
  } catch (err) {
    logger.error('Token refresh error', { error: err.message });
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Token refresh failed'
    });
  }
};

module.exports = {
  register,
  login,
  refreshToken
};
