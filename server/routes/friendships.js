// server/routes/friendships.js - Friendship endpoints
const express = require('express');
const friendshipController = require('../controllers/friendshipController');

const router = express.Router();

// GET /api/friendships - List friends
router.get('/', friendshipController.getFriendships);

// GET /api/friendships/requests/pending - List pending requests
router.get('/requests/pending', friendshipController.getPendingRequests);

// POST /api/friendships/requests - Send friend request
router.post('/requests', friendshipController.createFriendRequest);

module.exports = router;
