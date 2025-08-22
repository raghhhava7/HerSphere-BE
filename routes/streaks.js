const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const streaksController = require('../controllers/streaksController');

// All routes are protected with auth middleware

// GET all streaks for a user
router.get('/', authenticateToken, streaksController.getUserStreaks);

// GET streak for specific activity
router.get('/:activityType', authenticateToken, streaksController.getActivityStreak);

// PUT/POST update streak for an activity
router.put('/:activityType', authenticateToken, streaksController.updateStreak);
router.post('/:activityType', authenticateToken, streaksController.updateStreak);

module.exports = router;