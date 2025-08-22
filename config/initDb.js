const { pool } = require('./database');

const initializeDatabase = async () => {
  try {
    console.log('Initializing database tables...');

    // Users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Health uploads table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS health_uploads (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        file_url VARCHAR(500) NOT NULL,
        file_type VARCHAR(50),
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Period tracker table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS period_tracker (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        pain_start_date DATE NOT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Constipation tracker table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS constipation_tracker (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        status BOOLEAN NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, date)
      )
    `);

    // Water intake table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS water_intake (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        amount_ml INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, date)
      )
    `);

    // Exercise tracker table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS exercise_tracker (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        activity_type VARCHAR(100) NOT NULL,
        footsteps INTEGER CHECK (footsteps >= 1 AND footsteps <= 10000),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Shambhavi Kriya table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS shambhavi_kriya (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, date)
      )
    `);

    // Typing practice table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS typing_practice (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        completed BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, date)
      )
    `);

    // Subjects table (predefined)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS subjects (
        id SERIAL PRIMARY KEY,
        code VARCHAR(20) UNIQUE NOT NULL,
        name VARCHAR(200) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Units table (predefined)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS units (
        id SERIAL PRIMARY KEY,
        subject_id INTEGER REFERENCES subjects(id) ON DELETE CASCADE,
        unit_number INTEGER NOT NULL,
        title VARCHAR(300) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tasks table (user-defined)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        unit_id INTEGER REFERENCES units(id) ON DELETE CASCADE,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        completed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // NPTEL tasks table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS nptel_tasks (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        subject_id INTEGER REFERENCES subjects(id) ON DELETE CASCADE,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        completed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Education tasks table (for general education tasks)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS education_tasks (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        subject_code VARCHAR(20),
        unit_id INTEGER,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        completed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Research projects table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS research_projects (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        status VARCHAR(50) DEFAULT 'planning',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Study logs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS study_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        hours INTEGER CHECK (hours >= 1 AND hours <= 12),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, date)
      )
    `);

    // Sleep logs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sleep_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        hours INTEGER CHECK (hours >= 4 AND hours <= 12),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, date)
      )
    `);

    // Notifications table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(200) NOT NULL,
        message TEXT,
        scheduled_time TIME,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // User goals table for analytics
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_goals (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL, -- 'health' or 'education'
        metric VARCHAR(100) NOT NULL, -- 'water_intake', 'study_hours', etc.
        target DECIMAL(10,2) NOT NULL,
        description TEXT,
        status VARCHAR(20) DEFAULT 'active', -- 'active', 'completed', 'paused'
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Goal achievements table for tracking completed goals
    await pool.query(`
      CREATE TABLE IF NOT EXISTS goal_achievements (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        goal_id INTEGER REFERENCES user_goals(id) ON DELETE CASCADE,
        achieved_value DECIMAL(10,2) NOT NULL,
        achieved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // NPTEL courses table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS nptel_courses (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(200) NOT NULL,
        instructor VARCHAR(100) NOT NULL,
        duration VARCHAR(50),
        progress INTEGER DEFAULT 0,
        enrolled BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // NPTEL course tasks table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS nptel_course_tasks (
        id SERIAL PRIMARY KEY,
        course_id INTEGER REFERENCES nptel_courses(id) ON DELETE CASCADE,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        completed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // User streaks table for tracking daily activities
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_streaks (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        activity_type VARCHAR(50) NOT NULL, -- 'typing', 'kriya', 'water', 'exercise'
        current_streak INTEGER DEFAULT 0,
        longest_streak INTEGER DEFAULT 0,
        last_activity_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, activity_type)
      )
    `);

    // User profile table for additional user information
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
        full_name VARCHAR(100),
        bio TEXT,
        avatar_url VARCHAR(500),
        date_of_birth DATE,
        location VARCHAR(100),
        phone VARCHAR(20),
        emergency_contact VARCHAR(100),
        health_conditions TEXT,
        goals TEXT,
        preferences JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Assignments table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS assignments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        deadline DATE NOT NULL,
        subject VARCHAR(100),
        completed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Research tasks table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS research_tasks (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        subject_code VARCHAR(20) NOT NULL,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        type VARCHAR(50) DEFAULT 'Other',
        completed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Study and sleep logs combined table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS study_sleep_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        study_hours DECIMAL(4,1) DEFAULT 0 CHECK (study_hours >= 0 AND study_hours <= 12),
        sleep_hours DECIMAL(4,1) DEFAULT 8 CHECK (sleep_hours >= 4 AND sleep_hours <= 12),
        study_notes TEXT,
        sleep_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, date)
      )
    `);

    // Insert predefined subjects and units
    await insertPredefinedData();

    console.log('Database tables initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};

const insertPredefinedData = async () => {
  const subjects = [
    { code: 'ECO525', name: 'MICROECONOMIC THEORY AND ANALYSIS-I' },
    { code: 'ECO526', name: 'MACROECONOMIC THEORY AND ANALYSIS-I' },
    { code: 'ECO527', name: 'ECONOMIC THOUGHT' },
    { code: 'GEN530', name: 'FUNDAMENTALS OF RESEARCH' },
    { code: 'MGN500M', name: 'CAREER PLANNING' },
    { code: 'QTT502', name: 'STATISTICAL METHODS IN ECONOMICS' }
  ];

  const units = {
    'ECO525': [
      'Introduction to Microeconomics; Demand and Supply Analysis',
      'Utility Analysis; Revealed Preference Theory',
      'Production Function',
      'Cost Analysis and Estimation; Market Structure - Perfect Competition',
      'Monopoly and Monopolistic Competition',
      'Oligopoly'
    ],
    'ECO526': [
      'Introduction to Macroeconomics; Circular Flow of Income',
      'National Income',
      'Theories of Income, Output and Employment',
      'Consumption Function; Income-Consumption Relationship',
      'General Equilibrium of Economy',
      'Demand for Money'
    ],
    'ECO527': [
      'Introduction; Economic thought of Plato and Aristotle; Mercantilism; Physiocracy',
      'Classical Period (Adam Smith, Ricardo, Malthus, Mill)',
      'Marginalists Revolution',
      'Keynesian Period',
      'Neoclassical Welfare Economics',
      'Indian Economic Thought'
    ],
    'GEN530': [
      'Foundation of Research; Types of Research and Research Process',
      'Problem Identification and Formulation',
      'Qualitative and Quantitative Research; Measurement Concepts',
      'Interpretation of Data and Paper Writing; Research Funding and Scholarships',
      'Research and Publication Ethics, IPR and Scholarly Publishing',
      'Soft Computing and Research Applications'
    ],
    'MGN500M': [
      'Overview of Discipline, Program and Career Planning',
      'Edu Revolution (MOOCs, Projects, Internships, Competitions)',
      'Market Research and Identifying Functional Roles',
      'Certifications and Competitions',
      'Networking',
      'Defining Career Goals and Making Choices'
    ],
    'QTT502': [
      'Scope of Statistics; Data Classification and Presentation',
      'Measures of Central Tendency and Dispersion',
      'Correlation and Regression Analysis',
      'Time Series Analysis',
      'Hypothesis Testing',
      'Chi-square Test'
    ]
  };

  try {
    // Insert subjects
    for (const subject of subjects) {
      await pool.query(
        'INSERT INTO subjects (code, name) VALUES ($1, $2) ON CONFLICT (code) DO NOTHING',
        [subject.code, subject.name]
      );
    }

    // Insert units
    for (const [subjectCode, unitTitles] of Object.entries(units)) {
      const subjectResult = await pool.query('SELECT id FROM subjects WHERE code = $1', [subjectCode]);
      const subjectId = subjectResult.rows[0].id;

      for (let i = 0; i < unitTitles.length; i++) {
        await pool.query(
          'INSERT INTO units (subject_id, unit_number, title) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
          [subjectId, i + 1, unitTitles[i]]
        );
      }
    }

    console.log('Predefined subjects and units inserted successfully');
  } catch (error) {
    console.error('Error inserting predefined data:', error);
  }
};

module.exports = { initializeDatabase };