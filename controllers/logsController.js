const { pool } = require('../config/database');

const addStudyLog = async (req, res) => {
  try {
    const { date, hours } = req.body;
    const userId = req.user.id;

    if (!date || !hours) {
      return res.status(400).json({ error: 'Date and hours are required' });
    }

    if (hours < 1 || hours > 12) {
      return res.status(400).json({ error: 'Study hours must be between 1 and 12' });
    }

    const result = await pool.query(
      'INSERT INTO study_logs (user_id, date, hours) VALUES ($1, $2, $3) ON CONFLICT (user_id, date) DO UPDATE SET hours = $3, created_at = CURRENT_TIMESTAMP RETURNING *',
      [userId, date, hours]
    );

    res.status(201).json({
      message: 'Study log updated successfully',
      log: result.rows[0]
    });
  } catch (error) {
    console.error('Study log error:', error);
    res.status(500).json({ error: 'Failed to add study log' });
  }
};

const addSleepLog = async (req, res) => {
  try {
    const { date, hours } = req.body;
    const userId = req.user.id;

    if (!date || !hours) {
      return res.status(400).json({ error: 'Date and hours are required' });
    }

    if (hours < 4 || hours > 12) {
      return res.status(400).json({ error: 'Sleep hours must be between 4 and 12' });
    }

    const result = await pool.query(
      'INSERT INTO sleep_logs (user_id, date, hours) VALUES ($1, $2, $3) ON CONFLICT (user_id, date) DO UPDATE SET hours = $3, created_at = CURRENT_TIMESTAMP RETURNING *',
      [userId, date, hours]
    );

    res.status(201).json({
      message: 'Sleep log updated successfully',
      log: result.rows[0]
    });
  } catch (error) {
    console.error('Sleep log error:', error);
    res.status(500).json({ error: 'Failed to add sleep log' });
  }
};

const getUserLogs = async (req, res) => {
  try {
    const userId = req.user.id;
    const { start_date, end_date, type } = req.query;

    let whereClause = 'WHERE user_id = $1';
    let params = [userId];

    if (start_date) {
      params.push(start_date);
      whereClause += ` AND date >= $${params.length}`;
    }

    if (end_date) {
      params.push(end_date);
      whereClause += ` AND date <= $${params.length}`;
    }

    const logs = {};

    if (!type || type === 'study') {
      const studyResult = await pool.query(
        `SELECT * FROM study_logs ${whereClause} ORDER BY date DESC`,
        params
      );
      logs.study_logs = studyResult.rows;
    }

    if (!type || type === 'sleep') {
      const sleepResult = await pool.query(
        `SELECT * FROM sleep_logs ${whereClause} ORDER BY date DESC`,
        params
      );
      logs.sleep_logs = sleepResult.rows;
    }

    res.json({
      message: 'Logs retrieved successfully',
      ...logs
    });
  } catch (error) {
    console.error('Get logs error:', error);
    res.status(500).json({ error: 'Failed to retrieve logs' });
  }
};

module.exports = {
  addStudyLog,
  addSleepLog,
  getUserLogs
};