const { pool } = require('../config/database');

// NPTEL Courses Controllers
const addNPTELCourse = async (req, res) => {
  try {
    const { title, instructor, duration } = req.body;
    const userId = req.user.id;

    if (!title || !instructor) {
      return res.status(400).json({ error: 'Title and instructor are required' });
    }

    const result = await pool.query(
      'INSERT INTO nptel_courses (user_id, title, instructor, duration) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, title, instructor, duration || '8 weeks']
    );

    res.status(201).json({
      message: 'NPTEL course added successfully',
      course: result.rows[0]
    });
  } catch (error) {
    console.error('Add NPTEL course error:', error);
    res.status(500).json({ error: 'Failed to add NPTEL course' });
  }
};

const getNPTELCourses = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get courses with their tasks
    const coursesResult = await pool.query(
      'SELECT * FROM nptel_courses WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    const courses = [];
    for (const course of coursesResult.rows) {
      const tasksResult = await pool.query(
        'SELECT * FROM nptel_course_tasks WHERE course_id = $1 ORDER BY created_at DESC',
        [course.id]
      );
      
      courses.push({
        ...course,
        tasks: tasksResult.rows
      });
    }

    res.json({ courses });
  } catch (error) {
    console.error('Get NPTEL courses error:', error);
    res.status(500).json({ error: 'Failed to retrieve NPTEL courses' });
  }
};

const updateNPTELCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { title, instructor, duration, progress, enrolled } = req.body;
    const userId = req.user.id;

    const result = await pool.query(
      'UPDATE nptel_courses SET title = $1, instructor = $2, duration = $3, progress = $4, enrolled = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6 AND user_id = $7 RETURNING *',
      [title, instructor, duration, progress, enrolled, courseId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    res.json({
      message: 'Course updated successfully',
      course: result.rows[0]
    });
  } catch (error) {
    console.error('Update NPTEL course error:', error);
    res.status(500).json({ error: 'Failed to update course' });
  }
};

const deleteNPTELCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    const result = await pool.query(
      'DELETE FROM nptel_courses WHERE id = $1 AND user_id = $2 RETURNING *',
      [courseId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    res.json({ message: 'Course deleted successfully' });
  } catch (error) {
    console.error('Delete NPTEL course error:', error);
    res.status(500).json({ error: 'Failed to delete course' });
  }
};

// NPTEL Course Tasks Controllers
const addCourseTask = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { title, description } = req.body;
    const userId = req.user.id;

    if (!title) {
      return res.status(400).json({ error: 'Task title is required' });
    }

    // Verify course belongs to user
    const courseCheck = await pool.query(
      'SELECT id FROM nptel_courses WHERE id = $1 AND user_id = $2',
      [courseId, userId]
    );

    if (courseCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const result = await pool.query(
      'INSERT INTO nptel_course_tasks (course_id, title, description) VALUES ($1, $2, $3) RETURNING *',
      [courseId, title, description]
    );

    res.status(201).json({
      message: 'Task added successfully',
      task: result.rows[0]
    });
  } catch (error) {
    console.error('Add course task error:', error);
    res.status(500).json({ error: 'Failed to add task' });
  }
};

const updateCourseTask = async (req, res) => {
  try {
    const { courseId, taskId } = req.params;
    const { title, description, completed } = req.body;
    const userId = req.user.id;

    // Verify course belongs to user
    const courseCheck = await pool.query(
      'SELECT id FROM nptel_courses WHERE id = $1 AND user_id = $2',
      [courseId, userId]
    );

    if (courseCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const result = await pool.query(
      'UPDATE nptel_course_tasks SET title = $1, description = $2, completed = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 AND course_id = $5 RETURNING *',
      [title, description, completed, taskId, courseId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Update course progress
    const tasksResult = await pool.query(
      'SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE completed = true) as completed FROM nptel_course_tasks WHERE course_id = $1',
      [courseId]
    );

    const { total, completed: completedCount } = tasksResult.rows[0];
    const progress = total > 0 ? Math.round((completedCount / total) * 100) : 0;

    await pool.query(
      'UPDATE nptel_courses SET progress = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [progress, courseId]
    );

    res.json({
      message: 'Task updated successfully',
      task: result.rows[0]
    });
  } catch (error) {
    console.error('Update course task error:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
};

const deleteCourseTask = async (req, res) => {
  try {
    const { courseId, taskId } = req.params;
    const userId = req.user.id;

    // Verify course belongs to user
    const courseCheck = await pool.query(
      'SELECT id FROM nptel_courses WHERE id = $1 AND user_id = $2',
      [courseId, userId]
    );

    if (courseCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const result = await pool.query(
      'DELETE FROM nptel_course_tasks WHERE id = $1 AND course_id = $2 RETURNING *',
      [taskId, courseId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Delete course task error:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
};

// Subject and Task Controllers (for the route imports)
const getSubjects = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // For now, return a basic subject structure
    const subjects = [
      { code: 'CS101', name: 'Computer Science Fundamentals', units: [] },
      { code: 'MATH201', name: 'Advanced Mathematics', units: [] }
    ];

    res.json({ subjects });
  } catch (error) {
    console.error('Get subjects error:', error);
    res.status(500).json({ error: 'Failed to retrieve subjects' });
  }
};

const addTask = async (req, res) => {
  try {
    const { code, unitId } = req.params;
    const { title, description } = req.body;
    const userId = req.user.id;

    if (!title) {
      return res.status(400).json({ error: 'Task title is required' });
    }

    const result = await pool.query(
      'INSERT INTO education_tasks (user_id, subject_code, unit_id, title, description) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userId, code, unitId, title, description]
    );

    res.status(201).json({
      message: 'Task added successfully',
      task: result.rows[0]
    });
  } catch (error) {
    console.error('Add task error:', error);
    res.status(500).json({ error: 'Failed to add task' });
  }
};

const updateTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { title, description, completed } = req.body;
    const userId = req.user.id;

    const result = await pool.query(
      'UPDATE education_tasks SET title = $1, description = $2, completed = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 AND user_id = $5 RETURNING *',
      [title, description, completed, taskId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({
      message: 'Task updated successfully',
      task: result.rows[0]
    });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
};

const deleteTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user.id;

    const result = await pool.query(
      'DELETE FROM education_tasks WHERE id = $1 AND user_id = $2 RETURNING *',
      [taskId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
};

const addNptelTask = async (req, res) => {
  try {
    const { title, instructor, duration } = req.body;
    const userId = req.user.id;

    const result = await pool.query(
      'INSERT INTO nptel_courses (user_id, title, instructor, duration) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, title, instructor, duration]
    );

    res.status(201).json({
      message: 'NPTEL task added successfully',
      task: result.rows[0]
    });
  } catch (error) {
    console.error('Add NPTEL task error:', error);
    res.status(500).json({ error: 'Failed to add NPTEL task' });
  }
};

const addResearchProject = async (req, res) => {
  try {
    const { title, description, status, subject_code } = req.body;
    const userId = req.user.id;

    console.log('Adding research project:', { title, description, status, subject_code, userId });

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    let subjectId = null;
    
    // If subject_code is provided, get the subject_id
    if (subject_code) {
      console.log('Looking for subject with code:', subject_code);
      const subjectResult = await pool.query(
        'SELECT id FROM subjects WHERE code = $1',
        [subject_code]
      );
      
      console.log('Subject query result:', subjectResult.rows);
      
      if (subjectResult.rows.length > 0) {
        subjectId = subjectResult.rows[0].id;
        console.log('Found subject ID:', subjectId);
      } else {
        console.log('Subject not found, proceeding with null subject_id');
      }
    }

    console.log('Inserting research project with:', { userId, subjectId, title, description, status: status || 'planning' });

    const result = await pool.query(
      'INSERT INTO research_projects (user_id, subject_id, title, description, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userId, subjectId, title, description, status || 'planning']
    );

    console.log('Research project inserted successfully:', result.rows[0]);

    res.status(201).json({
      message: 'Research project added successfully',
      project: result.rows[0]
    });
  } catch (error) {
    console.error('Add research project error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      constraint: error.constraint
    });
    res.status(500).json({ error: 'Failed to add research project' });
  }
};

// Assignment Controllers
const getAssignments = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      'SELECT * FROM assignments WHERE user_id = $1 ORDER BY deadline ASC',
      [userId]
    );

    res.json({ assignments: result.rows });
  } catch (error) {
    console.error('Get assignments error:', error);
    res.status(500).json({ error: 'Failed to retrieve assignments' });
  }
};

const addAssignment = async (req, res) => {
  try {
    const { title, description, deadline, subject } = req.body;
    const userId = req.user.id;

    if (!title || !deadline) {
      return res.status(400).json({ error: 'Title and deadline are required' });
    }

    const result = await pool.query(
      'INSERT INTO assignments (user_id, title, description, deadline, subject) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userId, title, description, deadline, subject]
    );

    res.status(201).json({
      message: 'Assignment added successfully',
      assignment: result.rows[0]
    });
  } catch (error) {
    console.error('Add assignment error:', error);
    res.status(500).json({ error: 'Failed to add assignment' });
  }
};

const updateAssignment = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { title, description, deadline, subject, completed } = req.body;
    const userId = req.user.id;

    const result = await pool.query(
      'UPDATE assignments SET title = $1, description = $2, deadline = $3, subject = $4, completed = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6 AND user_id = $7 RETURNING *',
      [title, description, deadline, subject, completed, assignmentId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    res.json({
      message: 'Assignment updated successfully',
      assignment: result.rows[0]
    });
  } catch (error) {
    console.error('Update assignment error:', error);
    res.status(500).json({ error: 'Failed to update assignment' });
  }
};

const deleteAssignment = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const userId = req.user.id;

    const result = await pool.query(
      'DELETE FROM assignments WHERE id = $1 AND user_id = $2 RETURNING *',
      [assignmentId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    res.json({ message: 'Assignment deleted successfully' });
  } catch (error) {
    console.error('Delete assignment error:', error);
    res.status(500).json({ error: 'Failed to delete assignment' });
  }
};

// Research Project Task Controllers
const getResearchTasks = async (req, res) => {
  try {
    const { subjectCode } = req.params;
    const userId = req.user.id;

    const result = await pool.query(
      'SELECT * FROM research_tasks WHERE user_id = $1 AND subject_code = $2 ORDER BY created_at DESC',
      [userId, subjectCode]
    );

    res.json({ tasks: result.rows });
  } catch (error) {
    console.error('Get research tasks error:', error);
    res.status(500).json({ error: 'Failed to retrieve research tasks' });
  }
};

const addResearchTask = async (req, res) => {
  try {
    const { subjectCode } = req.params;
    const { title, description, type } = req.body;
    const userId = req.user.id;

    if (!title) {
      return res.status(400).json({ error: 'Task title is required' });
    }

    const result = await pool.query(
      'INSERT INTO research_tasks (user_id, subject_code, title, description, type) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userId, subjectCode, title, description, type || 'Other']
    );

    res.status(201).json({
      message: 'Research task added successfully',
      task: result.rows[0]
    });
  } catch (error) {
    console.error('Add research task error:', error);
    res.status(500).json({ error: 'Failed to add research task' });
  }
};

const updateResearchTask = async (req, res) => {
  try {
    const { subjectCode, taskId } = req.params;
    const { title, description, type, completed } = req.body;
    const userId = req.user.id;

    const result = await pool.query(
      'UPDATE research_tasks SET title = $1, description = $2, type = $3, completed = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 AND user_id = $6 AND subject_code = $7 RETURNING *',
      [title, description, type, completed, taskId, userId, subjectCode]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Research task not found' });
    }

    res.json({
      message: 'Research task updated successfully',
      task: result.rows[0]
    });
  } catch (error) {
    console.error('Update research task error:', error);
    res.status(500).json({ error: 'Failed to update research task' });
  }
};

const deleteResearchTask = async (req, res) => {
  try {
    const { subjectCode, taskId } = req.params;
    const userId = req.user.id;

    const result = await pool.query(
      'DELETE FROM research_tasks WHERE id = $1 AND user_id = $2 AND subject_code = $3 RETURNING *',
      [taskId, userId, subjectCode]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Research task not found' });
    }

    res.json({ message: 'Research task deleted successfully' });
  } catch (error) {
    console.error('Delete research task error:', error);
    res.status(500).json({ error: 'Failed to delete research task' });
  }
};

// Study & Sleep Logs Controllers
const getStudySleepLogs = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      'SELECT * FROM study_sleep_logs WHERE user_id = $1 ORDER BY date DESC',
      [userId]
    );

    res.json({ logs: result.rows });
  } catch (error) {
    console.error('Get study/sleep logs error:', error);
    res.status(500).json({ error: 'Failed to retrieve study/sleep logs' });
  }
};

const addStudySleepLog = async (req, res) => {
  try {
    const { date, studyHours, sleepHours, studyNotes, sleepNotes } = req.body;
    const userId = req.user.id;

    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    // Check if a log already exists for this user and date
    const existingLog = await pool.query(
      'SELECT id FROM study_sleep_logs WHERE user_id = $1 AND date = $2',
      [userId, date]
    );

    if (existingLog.rows.length > 0) {
      // Update existing log instead of creating a new one
      const result = await pool.query(
        'UPDATE study_sleep_logs SET study_hours = $1, sleep_hours = $2, study_notes = $3, sleep_notes = $4, updated_at = CURRENT_TIMESTAMP WHERE user_id = $5 AND date = $6 RETURNING *',
        [studyHours || 0, sleepHours || 8, studyNotes, sleepNotes, userId, date]
      );

      res.json({
        message: 'Study/sleep log updated successfully',
        log: result.rows[0]
      });
    } else {
      // Create new log
      const result = await pool.query(
        'INSERT INTO study_sleep_logs (user_id, date, study_hours, sleep_hours, study_notes, sleep_notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [userId, date, studyHours || 0, sleepHours || 8, studyNotes, sleepNotes]
      );

      res.status(201).json({
        message: 'Study/sleep log added successfully',
        log: result.rows[0]
      });
    }
  } catch (error) {
    console.error('Add study/sleep log error:', error);
    res.status(500).json({ error: 'Failed to add study/sleep log' });
  }
};

const updateStudySleepLog = async (req, res) => {
  try {
    const { logId } = req.params;
    const { date, studyHours, sleepHours, studyNotes, sleepNotes } = req.body;
    const userId = req.user.id;

    const result = await pool.query(
      'UPDATE study_sleep_logs SET date = $1, study_hours = $2, sleep_hours = $3, study_notes = $4, sleep_notes = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6 AND user_id = $7 RETURNING *',
      [date, studyHours, sleepHours, studyNotes, sleepNotes, logId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Study/sleep log not found' });
    }

    res.json({
      message: 'Study/sleep log updated successfully',
      log: result.rows[0]
    });
  } catch (error) {
    console.error('Update study/sleep log error:', error);
    res.status(500).json({ error: 'Failed to update study/sleep log' });
  }
};

const getUserTasks = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      'SELECT * FROM education_tasks WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    res.json({ tasks: result.rows });
  } catch (error) {
    console.error('Get user tasks error:', error);
    res.status(500).json({ error: 'Failed to retrieve tasks' });
  }
};

const getUnitTasks = async (req, res) => {
  try {
    const { code, unitId } = req.params;
    const userId = req.user.id;

    const result = await pool.query(
      'SELECT * FROM education_tasks WHERE user_id = $1 AND subject_code = $2 AND unit_id = $3 ORDER BY created_at DESC',
      [userId, code, unitId]
    );

    res.json({ tasks: result.rows });
  } catch (error) {
    console.error('Get unit tasks error:', error);
    res.status(500).json({ error: 'Failed to retrieve unit tasks' });
  }
};

module.exports = {
  // NPTEL functions
  addNPTELCourse,
  getNPTELCourses,
  updateNPTELCourse,
  deleteNPTELCourse,
  addCourseTask,
  updateCourseTask,
  deleteCourseTask,
  // Education route functions
  getSubjects,
  addTask,
  updateTask,
  deleteTask,
  addNptelTask,
  addResearchProject,
  getUserTasks,
  getUnitTasks,
  // Assignment functions
  getAssignments,
  addAssignment,
  updateAssignment,
  deleteAssignment,
  // Research task functions
  getResearchTasks,
  addResearchTask,
  updateResearchTask,
  deleteResearchTask,
  // Study/Sleep log functions
  getStudySleepLogs,
  addStudySleepLog,
  updateStudySleepLog
};