const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

const signup = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const result = await pool.query(
      'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email, created_at',
      [username, email, hashedPassword]
    );

    const user = result.rows[0];
    const token = generateToken(user.id);

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        created_at: user.created_at
      },
      token
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
};

const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validation
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user (allow login with username or email)
    const result = await pool.query(
      'SELECT id, username, email, password FROM users WHERE username = $1 OR email = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken(user.id);

    // Get user profile data
    const profileResult = await pool.query(
      'SELECT * FROM user_profiles WHERE user_id = $1',
      [user.id]
    );

    const profile = profileResult.rows[0] || {};

    // Get basic user data counts for dashboard
    const [tasksCount, educationTasksCount, nptelCoursesCount, studyLogsCount] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM tasks WHERE user_id = $1', [user.id]),
      pool.query('SELECT COUNT(*) as count FROM education_tasks WHERE user_id = $1', [user.id]),
      pool.query('SELECT COUNT(*) as count FROM nptel_courses WHERE user_id = $1', [user.id]),
      pool.query('SELECT COUNT(*) as count FROM study_logs WHERE user_id = $1', [user.id])
    ]);

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
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
      },
      token,
      dataExists: {
        tasks: parseInt(tasksCount.rows[0].count) > 0,
        educationTasks: parseInt(educationTasksCount.rows[0].count) > 0,
        nptelCourses: parseInt(nptelCoursesCount.rows[0].count) > 0,
        studyLogs: parseInt(studyLogsCount.rows[0].count) > 0
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

module.exports = { signup, login };