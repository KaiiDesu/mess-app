const express = require('express');
const noteController = require('../controllers/noteController');

const router = express.Router();

router.get('/', noteController.getNotes);
router.put('/me', noteController.upsertMyNote);
router.delete('/me', noteController.deleteMyNote);

module.exports = router;
