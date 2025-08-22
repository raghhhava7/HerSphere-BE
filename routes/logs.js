const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const {
  addStudyLog,
  addSleepLog,
  getUserLogs
} = require('../controllers/logsController');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// POST /logs/study
router.post('/study', addStudyLog);

// POST /logs/sleep
router.post('/sleep', addSleepLog);

// GET /logs (get user logs with optional filters)
router.get('/', getUserLogs);

module.exports = router;