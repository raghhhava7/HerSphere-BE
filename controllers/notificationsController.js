const { pool } = require('../config/database');

const createNotification = async (req, res) => {
  try {
    const { type, title, message, scheduled_time } = req.body;
    const userId = req.user.id;

    if (!type || !title) {
      return res.status(400).json({ error: 'Type and title are required' });
    }

    const validTypes = ['period', 'water', 'study', 'sleep', 'constipation', 'exercise', 'typing'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid notification type' });
    }

    const result = await pool.query(
      'INSERT INTO notifications (user_id, type, title, message, scheduled_time) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userId, type, title, message || null, scheduled_time || null]
    );

    res.status(201).json({
      message: 'Notification created successfully',
      notification: result.rows[0]
    });
  } catch (error) {
    console.error('Create notification error:', error);
    res.status(500).json({ error: 'Failed to create notification' });
  }
};

const getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, is_active } = req.query;

    let whereClause = 'WHERE user_id = $1';
    let params = [userId];

    if (type) {
      params.push(type);
      whereClause += ` AND type = $${params.length}`;
    }

    if (is_active !== undefined) {
      params.push(is_active === 'true');
      whereClause += ` AND is_active = $${params.length}`;
    }

    const result = await pool.query(
      `SELECT * FROM notifications ${whereClause} ORDER BY created_at DESC`,
      params
    );

    res.json({
      message: 'Notifications retrieved successfully',
      notifications: result.rows
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to retrieve notifications' });
  }
};

const updateNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, message, scheduled_time, is_active } = req.body;
    const userId = req.user.id;

    // Verify notification belongs to user
    const checkResult = await pool.query(
      'SELECT id FROM notifications WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    const result = await pool.query(
      'UPDATE notifications SET title = COALESCE($1, title), message = COALESCE($2, message), scheduled_time = COALESCE($3, scheduled_time), is_active = COALESCE($4, is_active), updated_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING *',
      [title, message, scheduled_time, is_active, id]
    );

    res.json({
      message: 'Notification updated successfully',
      notification: result.rows[0]
    });
  } catch (error) {
    console.error('Update notification error:', error);
    res.status(500).json({ error: 'Failed to update notification' });
  }
};

const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await pool.query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
};

module.exports = {
  createNotification,
  getNotifications,
  updateNotification,
  deleteNotification
};