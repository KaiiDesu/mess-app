// server/routes/conversations.js - Conversation endpoints
const express = require('express');
const conversationController = require('../controllers/conversationController');

const router = express.Router();

// GET /api/conversations - List all conversations
router.get('/', conversationController.getConversations);

// POST /api/conversations - Create new conversation
router.post('/', conversationController.createConversation);

// PATCH /api/conversations/:id/theme - Update conversation theme
router.patch('/:id/theme', conversationController.updateConversationTheme);

// PATCH /api/conversations/:id/nickname - Set/remove nickname for other user
router.patch('/:id/nickname', conversationController.updateConversationNickname);

// DELETE /api/conversations/:id - Delete conversation and its messages
router.delete('/:id', conversationController.deleteConversation);

// GET /api/conversations/:id - Get specific conversation
router.get('/:id', conversationController.getConversation);

// GET /api/conversations/:id/messages - Get messages in conversation
router.get('/:id/messages', conversationController.getMessages);

module.exports = router;
