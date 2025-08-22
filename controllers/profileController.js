const { pool } = require('../config/database');

// Get user profile
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user basic info
    const userResult = await pool.query(
      'SELECT id, username, email, created_at FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user profile details
    const profileResult = await pool.query(
      'SELECT * FROM user_profiles WHERE user_id = $1',
      [userId]
    );

    const user = userResult.rows[0];
    const profile = profileResult.rows[0] || {};

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        created_at: user.created_at,
        profile: {
          full_name: profile.full_name || '',
          bio: profile.bio || '',
          avatar_url: profile.avatar_url || '',
          date_of_birth: profile.date_of_birth || null,
          location: profile.location || '',
          phone: profile.phone || '',
          emergency_contact: profile.emergency_contact || '',
          health_conditions: profile.health_conditions || '',
          goals: profile.goals || '',
          preferences: profile.preferences || {}
        }
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to retrieve profile' });
  }
};

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      email,
      full_name,
      bio,
      avatar_url,
      date_of_birth,
      location,
      phone,
      emergency_contact,
      health_conditions,
      goals,
      preferences
    } = req.body;

    // Update user email if provided
    if (email) {
      // First check if the email is different from the user's current email
      const currentUserEmail = await pool.query(
        'SELECT email FROM users WHERE id = $1',
        [userId]
      );
      
      // Only check for duplicates if the email is actually changing
      if (currentUserEmail.rows[0].email !== email) {
        // Check if email is already taken by another user
        const emailCheck = await pool.query(
          'SELECT id FROM users WHERE email = $1 AND id != $2',
          [email, userId]
        );

        if (emailCheck.rows.length > 0) {
          return res.status(400).json({ error: 'Email already exists' });
        }
      }

      await pool.query(
        'UPDATE users SET email = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [email, userId]
      );
    }

    // Update or create user profile
    // Only update fields that are provided (not undefined)
    const updateFields = [];
    const updateValues = [userId]; // Start with userId as $1
    let paramIndex = 2; // Start parameter index at 2
    
    // Build dynamic query based on provided fields
    if (full_name !== undefined) {
      updateFields.push(`full_name = $${paramIndex}`);
      updateValues.push(full_name);
      paramIndex++;
    }
    
    if (bio !== undefined) {
      updateFields.push(`bio = $${paramIndex}`);
      updateValues.push(bio);
      paramIndex++;
    }
    
    if (avatar_url !== undefined) {
      updateFields.push(`avatar_url = $${paramIndex}`);
      updateValues.push(avatar_url);
      paramIndex++;
    }
    
    if (date_of_birth !== undefined) {
      updateFields.push(`date_of_birth = $${paramIndex}`);
      updateValues.push(date_of_birth);
      paramIndex++;
    }
    
    if (location !== undefined) {
      updateFields.push(`location = $${paramIndex}`);
      updateValues.push(location);
      paramIndex++;
    }
    
    if (phone !== undefined) {
      updateFields.push(`phone = $${paramIndex}`);
      updateValues.push(phone);
      paramIndex++;
    }
    
    if (emergency_contact !== undefined) {
      updateFields.push(`emergency_contact = $${paramIndex}`);
      updateValues.push(emergency_contact);
      paramIndex++;
    }
    
    if (health_conditions !== undefined) {
      updateFields.push(`health_conditions = $${paramIndex}`);
      updateValues.push(health_conditions);
      paramIndex++;
    }
    
    if (goals !== undefined) {
      updateFields.push(`goals = $${paramIndex}`);
      updateValues.push(goals);
      paramIndex++;
    }
    
    if (preferences !== undefined) {
      updateFields.push(`preferences = $${paramIndex}`);
      updateValues.push(preferences);
      paramIndex++;
    }
    
    // Add updated_at timestamp
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    
    // Create the SQL query
    let query;
    if (updateFields.length > 0) {
      // If we have fields to update, create an update query
      query = `
        INSERT INTO user_profiles (user_id)
        VALUES ($1)
        ON CONFLICT (user_id) 
        DO UPDATE SET ${updateFields.join(', ')}
        RETURNING *
      `;
    } else {
      // If no fields to update, just ensure the user has a profile record
      query = `
        INSERT INTO user_profiles (user_id)
        VALUES ($1)
        ON CONFLICT (user_id) DO NOTHING
        RETURNING *
      `;
    }
    
    const profileResult = await pool.query(query, updateValues);

    res.json({
      message: 'Profile updated successfully',
      profile: profileResult.rows[0]
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

// Get user dashboard data (all user data for login)
const getDashboardData = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all user data in parallel
    const [
      userProfile,
      tasks,
      educationTasks,
      nptelCourses,
      researchProjects,
      studyLogs,
      sleepLogs,
      studySleepLogs,
      waterIntake,
      exerciseTracker,
      typingPractice,
      shambhaviKriya,
      userStreaks,
      notifications,
      userGoals
    ] = await Promise.all([
      // User profile
      pool.query(`
        SELECT u.id, u.username, u.email, u.created_at,
               p.full_name, p.bio, p.avatar_url, p.date_of_birth, 
               p.location, p.phone, p.emergency_contact, p.health_conditions, 
               p.goals, p.preferences
        FROM users u
        LEFT JOIN user_profiles p ON u.id = p.user_id
        WHERE u.id = $1
      `, [userId]),

      // Tasks
      pool.query('SELECT * FROM tasks WHERE user_id = $1 ORDER BY created_at DESC', [userId]),

      // Education tasks
      pool.query('SELECT * FROM education_tasks WHERE user_id = $1 ORDER BY created_at DESC', [userId]),

      // NPTEL courses with tasks
      pool.query(`
        SELECT c.*, 
               COALESCE(json_agg(
                 json_build_object(
                   'id', t.id,
                   'title', t.title,
                   'description', t.description,
                   'completed', t.completed,
                   'created_at', t.created_at
                 ) ORDER BY t.created_at
               ) FILTER (WHERE t.id IS NOT NULL), '[]') as tasks
        FROM nptel_courses c
        LEFT JOIN nptel_course_tasks t ON c.id = t.course_id
        WHERE c.user_id = $1
        GROUP BY c.id
        ORDER BY c.created_at DESC
      `, [userId]),

      // Research projects
      pool.query('SELECT * FROM research_projects WHERE user_id = $1 ORDER BY created_at DESC', [userId]),

      // Study logs (legacy - keep for backward compatibility)
      pool.query('SELECT * FROM study_logs WHERE user_id = $1 ORDER BY date DESC LIMIT 30', [userId]),

      // Sleep logs (legacy - keep for backward compatibility)
      pool.query('SELECT * FROM sleep_logs WHERE user_id = $1 ORDER BY date DESC LIMIT 30', [userId]),

      // Study & Sleep logs (new combined table)
      pool.query('SELECT * FROM study_sleep_logs WHERE user_id = $1 ORDER BY date DESC LIMIT 30', [userId]),

      // Water intake
      pool.query('SELECT * FROM water_intake WHERE user_id = $1 ORDER BY date DESC LIMIT 30', [userId]),

      // Exercise tracker
      pool.query('SELECT * FROM exercise_tracker WHERE user_id = $1 ORDER BY date DESC LIMIT 30', [userId]),

      // Typing practice
      pool.query('SELECT * FROM typing_practice WHERE user_id = $1 ORDER BY date DESC LIMIT 30', [userId]),

      // Shambhavi Kriya
      pool.query('SELECT * FROM shambhavi_kriya WHERE user_id = $1 ORDER BY date DESC LIMIT 30', [userId]),

      // User streaks
      pool.query('SELECT * FROM user_streaks WHERE user_id = $1', [userId]),

      // Notifications
      pool.query('SELECT * FROM notifications WHERE user_id = $1 AND is_active = true ORDER BY created_at DESC', [userId]),

      // User goals
      pool.query('SELECT * FROM user_goals WHERE user_id = $1 ORDER BY created_at DESC', [userId])
    ]);

    const user = userProfile.rows[0];
    
    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        created_at: user.created_at,
        profile: {
          full_name: user.full_name || '',
          bio: user.bio || '',
          avatar_url: user.avatar_url || '',
          date_of_birth: user.date_of_birth || null,
          location: user.location || '',
          phone: user.phone || '',
          emergency_contact: user.emergency_contact || '',
          health_conditions: user.health_conditions || '',
          goals: user.goals || '',
          preferences: user.preferences || {}
        }
      },
      data: {
        tasks: tasks.rows,
        educationTasks: educationTasks.rows,
        nptelCourses: nptelCourses.rows,
        researchProjects: researchProjects.rows,
        studyLogs: studyLogs.rows,
        sleepLogs: sleepLogs.rows,
        studySleepLogs: studySleepLogs.rows,
        waterIntake: waterIntake.rows,
        exerciseTracker: exerciseTracker.rows,
        typingPractice: typingPractice.rows,
        shambhaviKriya: shambhaviKriya.rows,
        userStreaks: userStreaks.rows,
        notifications: notifications.rows,
        userGoals: userGoals.rows
      }
    });
  } catch (error) {
    console.error('Get dashboard data error:', error);
    res.status(500).json({ error: 'Failed to retrieve dashboard data' });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  getDashboardData
};