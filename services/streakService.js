const { pool } = require('../config/database');

/**
 * Update user streak for a specific activity
 * @param {number} userId - User ID
 * @param {string} activityType - Type of activity ('typing', 'kriya', 'water', 'exercise')
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {boolean} completed - Whether the activity was completed
 * @returns {Object} - Updated streak information
 */
const updateUserStreak = async (userId, activityType, date, completed) => {
  try {
    const activityDate = new Date(date);
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

    if (completed) {
      // Activity was completed
      if (lastActivityDate) {
        lastActivityDate.setHours(0, 0, 0, 0);
        const daysDiff = Math.floor((activityDate - lastActivityDate) / (1000 * 60 * 60 * 24));
        
        if (daysDiff === 1) {
          // Consecutive day - increment streak
          currentStreak += 1;
        } else if (daysDiff === 0) {
          // Same day - don't change streak count, just update date
          // This handles multiple updates on the same day
        } else {
          // Gap in days - reset streak to 1
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
    } else {
      // Activity was not completed - check if we need to reset streak
      if (lastActivityDate) {
        lastActivityDate.setHours(0, 0, 0, 0);
        const daysDiff = Math.floor((activityDate - lastActivityDate) / (1000 * 60 * 60 * 24));
        
        if (daysDiff > 1) {
          // Gap detected - reset streak to 0
          currentStreak = 0;
          
          if (streakResult.rows.length > 0) {
            await pool.query(
              'UPDATE user_streaks SET current_streak = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND activity_type = $3',
              [currentStreak, userId, activityType]
            );
          }
        }
      }
    }

    return {
      success: true,
      data: {
        currentStreak,
        longestStreak,
        lastActivityDate: date
      }
    };

  } catch (error) {
    console.error('Error updating streak:', error);
    return {
      success: false,
      error: 'Failed to update streak'
    };
  }
};

/**
 * Get user streak for a specific activity
 * @param {number} userId - User ID
 * @param {string} activityType - Type of activity
 * @returns {Object} - Streak information
 */
const getUserStreak = async (userId, activityType) => {
  try {
    const result = await pool.query(
      'SELECT * FROM user_streaks WHERE user_id = $1 AND activity_type = $2',
      [userId, activityType]
    );

    if (result.rows.length > 0) {
      const streak = result.rows[0];
      return {
        success: true,
        data: {
          currentStreak: streak.current_streak,
          longestStreak: streak.longest_streak,
          lastActivityDate: streak.last_activity_date
        }
      };
    } else {
      return {
        success: true,
        data: {
          currentStreak: 0,
          longestStreak: 0,
          lastActivityDate: null
        }
      };
    }
  } catch (error) {
    console.error('Error getting streak:', error);
    return {
      success: false,
      error: 'Failed to get streak'
    };
  }
};

/**
 * Reset user streak for a specific activity
 * @param {number} userId - User ID
 * @param {string} activityType - Type of activity
 * @returns {Object} - Result of reset operation
 */
const resetUserStreak = async (userId, activityType) => {
  try {
    await pool.query(
      'UPDATE user_streaks SET current_streak = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND activity_type = $2',
      [userId, activityType]
    );

    return {
      success: true,
      message: 'Streak reset successfully'
    };
  } catch (error) {
    console.error('Error resetting streak:', error);
    return {
      success: false,
      error: 'Failed to reset streak'
    };
  }
};

module.exports = {
  updateUserStreak,
  getUserStreak,
  resetUserStreak
};