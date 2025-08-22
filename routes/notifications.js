const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const {
  getNotifications,
  createNotification,
  updateNotification,
  deleteNotification
} = require('../controllers/notificationsController');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// GET /notifications
router.get('/', getNotifications);

// POST /notifications
router.post('/', createNotification);

// PUT /notifications/:id
router.put('/:id', updateNotification);

// DELETE /notifications/:id
router.delete('/:id', deleteNotification);

module.exports = router;