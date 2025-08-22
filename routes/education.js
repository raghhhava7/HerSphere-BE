const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const {
  getSubjects,
  addTask,
  updateTask,
  deleteTask,
  addNptelTask,
  addResearchProject,
  getUserTasks,
  getUnitTasks,
  // NPTEL functions
  addNPTELCourse,
  getNPTELCourses,
  updateNPTELCourse,
  deleteNPTELCourse,
  addCourseTask,
  updateCourseTask,
  deleteCourseTask,
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
} = require('../controllers/educationController');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// GET /education/subjects
router.get('/subjects', getSubjects);

// GET /education/tasks (get all user tasks)
router.get('/tasks', getUserTasks);

// GET /education/subject/:code/unit/:unitId/tasks (get tasks for specific unit)
router.get('/subject/:code/unit/:unitId/tasks', getUnitTasks);

// POST /education/subject/:code/unit/:unitId/task
router.post('/subject/:code/unit/:unitId/task', addTask);

// PUT /education/subject/:code/unit/:unitId/task/:taskId
router.put('/subject/:code/unit/:unitId/task/:taskId', updateTask);

// DELETE /education/subject/:code/unit/:unitId/task/:taskId
router.delete('/subject/:code/unit/:unitId/task/:taskId', deleteTask);

// POST /education/nptel
router.post('/nptel', addNptelTask);

// POST /education/research
router.post('/research', addResearchProject);

// NPTEL Courses routes
// GET /education/nptel/courses
router.get('/nptel/courses', getNPTELCourses);

// POST /education/nptel/course
router.post('/nptel/course', addNPTELCourse);

// PUT /education/nptel/course/:courseId
router.put('/nptel/course/:courseId', updateNPTELCourse);

// DELETE /education/nptel/course/:courseId
router.delete('/nptel/course/:courseId', deleteNPTELCourse);

// POST /education/nptel/course/:courseId/task
router.post('/nptel/course/:courseId/task', addCourseTask);

// PUT /education/nptel/course/:courseId/task/:taskId
router.put('/nptel/course/:courseId/task/:taskId', updateCourseTask);

// DELETE /education/nptel/course/:courseId/task/:taskId
router.delete('/nptel/course/:courseId/task/:taskId', deleteCourseTask);

// Assignment routes
// GET /education/assignments
router.get('/assignments', getAssignments);

// POST /education/assignment
router.post('/assignment', addAssignment);

// PUT /education/assignment/:assignmentId
router.put('/assignment/:assignmentId', updateAssignment);

// DELETE /education/assignment/:assignmentId
router.delete('/assignment/:assignmentId', deleteAssignment);

// Research task routes
// GET /education/research/subject/:subjectCode/tasks
router.get('/research/subject/:subjectCode/tasks', getResearchTasks);

// POST /education/research/subject/:subjectCode/task
router.post('/research/subject/:subjectCode/task', addResearchTask);

// PUT /education/research/subject/:subjectCode/task/:taskId
router.put('/research/subject/:subjectCode/task/:taskId', updateResearchTask);

// DELETE /education/research/subject/:subjectCode/task/:taskId
router.delete('/research/subject/:subjectCode/task/:taskId', deleteResearchTask);

// Study & Sleep logs routes
// GET /education/study-sleep-logs
router.get('/study-sleep-logs', getStudySleepLogs);

// POST /education/study-sleep-log
router.post('/study-sleep-log', addStudySleepLog);

// PUT /education/study-sleep-log/:logId
router.put('/study-sleep-log/:logId', updateStudySleepLog);

module.exports = router;