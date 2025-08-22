const express = require('express');
const { upload } = require('../config/cloudinary');
const { authenticateToken } = require('../middleware/auth');
const {
  uploadHealthDocument,
  addPeriodEntry,
  addConstipationEntry,
  addWaterIntake,
  addExerciseEntry,
  addKriyaEntry,
  addTypingEntry,
  getHealthUploads,
  getHealthDocumentsFolder,
  deleteHealthDocument,
  getPeriodEntries,
  getWaterIntake,
  getExerciseEntries,
  getKriyaEntries,
  getTypingEntries,
  deleteExerciseEntry,
  getUserStreakData
} = require('../controllers/healthController');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// POST /health/upload
router.post('/upload', upload.single('file'), uploadHealthDocument);

// POST /health/period
router.post('/period', addPeriodEntry);

// POST /health/constipation
router.post('/constipation', addConstipationEntry);

// POST /health/water
router.post('/water', addWaterIntake);

// POST /health/exercise
router.post('/exercise', addExerciseEntry);

// POST /health/kriya
router.post('/kriya', addKriyaEntry);

// POST /health/typing
router.post('/typing', addTypingEntry);

// GET endpoints for retrieving data
// GET /health/uploads
router.get('/uploads', getHealthUploads);

// GET /health/documents/folder - Get organized health documents folder
router.get('/documents/folder', getHealthDocumentsFolder);

// DELETE /health/documents/:documentId - Delete health document
router.delete('/documents/:documentId', deleteHealthDocument);

// GET /health/period
router.get('/period', getPeriodEntries);

// GET /health/water
router.get('/water', getWaterIntake);

// GET /health/exercise
router.get('/exercise', getExerciseEntries);

// GET /health/kriya
router.get('/kriya', getKriyaEntries);

// GET /health/typing
router.get('/typing', getTypingEntries);

// DELETE /health/exercise/:exerciseId - Delete exercise entry
router.delete('/exercise/:exerciseId', deleteExerciseEntry);

// GET /health/streak/:activityType - Get user streak for specific activity
router.get('/streak/:activityType', getUserStreakData);

module.exports = router;