const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const {
  getHealthAnalytics,
  getEducationAnalytics,
  getPersonalizedInsights,
  getGoals,
  createGoal,
  updateGoal,
  checkGoalAchievements,
  getGoalStreaks,
  getGoalCompletionStats,
  setGoalReminder,
  exportAnalytics
} = require('../controllers/analyticsController');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// GET /analytics/health
router.get('/health', getHealthAnalytics);

// GET /analytics/education
router.get('/education', getEducationAnalytics);

// GET /analytics/insights
router.get('/insights', getPersonalizedInsights);

// Goals management routes
// GET /analytics/goals - Get all user goals with progress
router.get('/goals', getGoals);

// POST /analytics/goals - Create a new goal
router.post('/goals', createGoal);

// PUT /analytics/goals/:id - Update a goal
router.put('/goals/:id', updateGoal);

// GET /analytics/goals/achievements - Check for goal achievements
router.get('/goals/achievements', checkGoalAchievements);

// GET /analytics/goals/streaks - Get goal streaks
router.get('/goals/streaks', getGoalStreaks);

// GET /analytics/goals/stats - Get goal completion statistics
router.get('/goals/stats', getGoalCompletionStats);

// POST /analytics/goals/:id/reminder - Set a reminder for a goal
router.post('/goals/:id/reminder', setGoalReminder);

// GET /analytics/export
router.get('/export', exportAnalytics);

module.exports = router;