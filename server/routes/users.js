// server/routes/users.js - User profile endpoints
const express = require('express');
const userController = require('../controllers/userController');

const router = express.Router();

// GET /api/users/me - Get current user
router.get('/me', userController.getCurrentUser);

// GET /api/users/search?q=alex - Search users
router.get('/search', userController.searchUsers);

// GET /api/users/:id - Get user by ID
router.get('/:id', userController.getUserById);

// PUT /api/users/me - Update profile (reuse me endpoint)
router.put('/me', userController.updateProfile);

module.exports = router;
