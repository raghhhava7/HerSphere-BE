const { pool } = require('../config/database');

// Update streak for an activity
const updateStreak = async (req, res) => {
  try {
    const { activityType } = req.params;
    const { date } = req.body;
    const userId = req.user.id;

    if (!activityType || !date) {
      return res.status(400).json({ error: 'Activity type and date are required' });
    }

    const activityDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    activityDate.setHours(0, 0, 0, 0);

    // Get current streak data
    const streakResult = await pool.query(
      'SELECT * FROM user_streaks WHERE user_id = $1 AND activity_type = $2',
      [userId, activityType]
    );

    let currentStreak = 0;
    let longestStreak = 0;
    let lastActivityDate = null;

    if (streakResult.rows.length > 0) {
      const streak = streakResult.rows[0];
      currentStreak = streak.current_streak;
      longestStreak = streak.longest_streak;
      lastActivityDate = streak.last_activity_date ? new Date(streak.last_activity_date) : null;
    }

    // Calculate new streak
    if (lastActivityDate) {
      const daysDiff = Math.floor((activityDate - lastActivityDate) / (1000 * 60 * 60 * 24));
      
      if (daysDiff === 1) {
        // Consecutive day - increment streak
        currentStreak += 1;
      } else if (daysDiff === 0) {
        // Same day - no change
        // Don't update streak
      } else {
        // Gap in days - reset streak
        currentStreak = 1;
      }
    } else {
      // First activity
      currentStreak = 1;
    }

    // Update longest streak if current is higher
    if (currentStreak > longestStreak) {
      longestStreak = currentStreak;
    }

    // Update or insert streak record
    if (streakResult.rows.length > 0) {
      await pool.query(
        'UPDATE user_streaks SET current_streak = $1, longest_streak = $2, last_activity_date = $3, updated_at = CURRENT_TIMESTAMP WHERE user_id = $4 AND activity_type = $5',
        [currentStreak, longestStreak, date, userId, activityType]
      );
    } else {
      await pool.query(
        'INSERT INTO user_streaks (user_id, activity_type, current_streak, longest_streak, last_activity_date) VALUES ($1, $2, $3, $4, $5)',
        [userId, activityType, currentStreak, longestStreak, date]
      );
    }

    res.json({
      message: 'Streak updated successfully',
      streak: {
        activity_type: activityType,
        current_streak: currentStreak,
        longest_streak: longestStreak,
        last_activity_date: date
      }
    });
  } catch (error) {
    console.error('Update streak error:', error);
    res.status(500).json({ error: 'Failed to update streak' });
  }
};

// Get all streaks for a user
const getUserStreaks = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      'SELECT * FROM user_streaks WHERE user_id = $1 ORDER BY activity_type',
      [userId]
    );

    const streaks = {};
    result.rows.forEach(row => {
      streaks[row.activity_type] = {
        current_streak: row.current_streak,
        longest_streak: row.longest_streak,
        last_activity_date: row.last_activity_date
      };
    });

    res.json({ streaks });
  } catch (error) {
    console.error('Get user streaks error:', error);
    res.status(500).json({ error: 'Failed to retrieve streaks' });
  }
};

// Get streak for specific activity
const getActivityStreak = async (req, res) => {
  try {
    const { activityType } = req.params;
    const userId = req.user.id;

    if (!activityType) {
      return res.status(400).json({ error: 'Activity type is required' });
    }

    const result = await pool.query(
      'SELECT * FROM user_streaks WHERE user_id = $1 AND activity_type = $2',
      [userId, activityType]
    );

    if (result.rows.length === 0) {
      return res.json({
        streak: {
          activity_type: activityType,
          current_streak: 0,
          longest_streak: 0,
          last_activity_date: null
        }
      });
    }

    const streak = result.rows[0];
    res.json({
      streak: {
        activity_type: activityType,
        current_streak: streak.current_streak,
        longest_streak: streak.longest_streak,
        last_activity_date: streak.last_activity_date
      }
    });
  } catch (error) {
    console.error('Get activity streak error:', error);
    res.status(500).json({ error: 'Failed to retrieve streak' });
  }
};

module.exports = {
  updateStreak,
  getUserStreaks,
  getActivityStreak
};