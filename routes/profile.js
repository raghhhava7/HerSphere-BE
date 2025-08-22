const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const {
  getProfile,
  updateProfile,
  getDashboardData
} = require('../controllers/profileController');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// GET /profile - Get user profile
router.get('/', getProfile);

// PUT /profile - Update user profile
router.put('/', updateProfile);

// GET /profile/dashboard - Get all user data for dashboard
router.get('/dashboard', getDashboardData);

module.exports = router;