const { pool } = require('../config/database');
const { uploadToCloudinary } = require('../config/cloudinary');
const { updateUserStreak, getUserStreak } = require('../services/streakService');

const uploadHealthDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { description } = req.body;
    const userId = req.user.id;

    // Upload to Cloudinary
    const result = await uploadToCloudinary(req.file.buffer, {
      folder: 'hersphere'
    });

    // Save to database
    const dbResult = await pool.query(
      'INSERT INTO health_uploads (user_id, file_url, file_type, description) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, result.secure_url, req.file.mimetype, description || null]
    );

    res.status(201).json({
      message: 'File uploaded successfully',
      upload: dbResult.rows[0]
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
};

const addPeriodEntry = async (req, res) => {
  try {
    const { pain_start_date, notes } = req.body;
    const userId = req.user.id;

    if (!pain_start_date) {
      return res.status(400).json({ error: 'Pain start date is required' });
    }

    const result = await pool.query(
      'INSERT INTO period_tracker (user_id, pain_start_date, notes) VALUES ($1, $2, $3) RETURNING *',
      [userId, pain_start_date, notes || null]
    );

    res.status(201).json({
      message: 'Period entry added successfully',
      entry: result.rows[0]
    });
  } catch (error) {
    console.error('Period entry error:', error);
    res.status(500).json({ error: 'Failed to add period entry' });
  }
};

const addConstipationEntry = async (req, res) => {
  try {
    const { date, status } = req.body;
    const userId = req.user.id;

    if (!date || typeof status !== 'boolean') {
      return res.status(400).json({ error: 'Date and status (boolean) are required' });
    }

    const result = await pool.query(
      'INSERT INTO constipation_tracker (user_id, date, status) VALUES ($1, $2, $3) ON CONFLICT (user_id, date) DO UPDATE SET status = $3, created_at = CURRENT_TIMESTAMP RETURNING *',
      [userId, date, status]
    );

    res.status(201).json({
      message: 'Constipation entry updated successfully',
      entry: result.rows[0]
    });
  } catch (error) {
    console.error('Constipation entry error:', error);
    res.status(500).json({ error: 'Failed to add constipation entry' });
  }
};

const addWaterIntake = async (req, res) => {
  try {
    const { date, amount_ml } = req.body;
    const userId = req.user.id;

    if (!date || !amount_ml || amount_ml <= 0) {
      return res.status(400).json({ error: 'Date and valid amount (ml) are required' });
    }

    const result = await pool.query(
      'INSERT INTO water_intake (user_id, date, amount_ml) VALUES ($1, $2, $3) ON CONFLICT (user_id, date) DO UPDATE SET amount_ml = $3, created_at = CURRENT_TIMESTAMP RETURNING *',
      [userId, date, amount_ml]
    );

    // Update water intake streak
    await updateUserStreak(userId, 'water', date, true);

    res.status(201).json({
      message: 'Water intake updated successfully',
      entry: result.rows[0]
    });
  } catch (error) {
    console.error('Water intake error:', error);
    res.status(500).json({ error: 'Failed to add water intake' });
  }
};

const addExerciseEntry = async (req, res) => {
  try {
    const { date, activity_type, footsteps } = req.body;
    const userId = req.user.id;

    if (!date || !activity_type || !footsteps) {
      return res.status(400).json({ error: 'Date, activity type, and footsteps are required' });
    }

    if (footsteps < 1 || footsteps > 10000) {
      return res.status(400).json({ error: 'Footsteps must be between 1 and 10,000' });
    }

    const result = await pool.query(
      'INSERT INTO exercise_tracker (user_id, date, activity_type, footsteps) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, date, activity_type, footsteps]
    );

    // Update exercise streak
    await updateUserStreak(userId, 'exercise', date, true);

    res.status(201).json({
      message: 'Exercise entry added successfully',
      entry: result.rows[0]
    });
  } catch (error) {
    console.error('Exercise entry error:', error);
    res.status(500).json({ error: 'Failed to add exercise entry' });
  }
};

const addKriyaEntry = async (req, res) => {
  try {
    const { date, notes, completed = true } = req.body;
    const userId = req.user.id;

    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    const result = await pool.query(
      'INSERT INTO shambhavi_kriya (user_id, date, notes) VALUES ($1, $2, $3) ON CONFLICT (user_id, date) DO UPDATE SET notes = $3, created_at = CURRENT_TIMESTAMP RETURNING *',
      [userId, date, notes || null]
    );

    // Update kriya streak with completion status
    await updateUserStreak(userId, 'kriya', date, completed);

    res.status(201).json({
      message: 'Shambhavi Kriya entry updated successfully',
      entry: result.rows[0]
    });
  } catch (error) {
    console.error('Kriya entry error:', error);
    res.status(500).json({ error: 'Failed to add Kriya entry' });
  }
};

const addTypingEntry = async (req, res) => {
  try {
    const { date, completed } = req.body;
    const userId = req.user.id;

    if (!date || typeof completed !== 'boolean') {
      return res.status(400).json({ error: 'Date and completed status (boolean) are required' });
    }

    const result = await pool.query(
      'INSERT INTO typing_practice (user_id, date, completed) VALUES ($1, $2, $3) ON CONFLICT (user_id, date) DO UPDATE SET completed = $3, created_at = CURRENT_TIMESTAMP RETURNING *',
      [userId, date, completed]
    );

    // Update typing streak with completion status
    await updateUserStreak(userId, 'typing', date, completed);

    res.status(201).json({
      message: 'Typing practice entry updated successfully',
      entry: result.rows[0]
    });
  } catch (error) {
    console.error('Typing entry error:', error);
    res.status(500).json({ error: 'Failed to add typing entry' });
  }
};

// GET endpoints for retrieving data
const getHealthUploads = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      'SELECT * FROM health_uploads WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    res.json({
      uploads: result.rows
    });
  } catch (error) {
    console.error('Get health uploads error:', error);
    res.status(500).json({ error: 'Failed to retrieve health uploads' });
  }
};

// Get all health documents organized in folder structure
const getHealthDocumentsFolder = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get all health uploads
    const uploadsResult = await pool.query(
      'SELECT id, file_url, file_type, description, created_at FROM health_uploads WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    // Organize documents by type
    const documentsByType = {
      images: [],
      documents: [],
      reports: [],
      other: []
    };

    const totalSize = uploadsResult.rows.length;
    
    uploadsResult.rows.forEach(upload => {
      const doc = {
        id: upload.id,
        name: upload.description || `Document ${upload.id}`,
        url: upload.file_url,
        type: upload.file_type,
        uploadDate: upload.created_at,
        size: 'Unknown' // Cloudinary doesn't store size in our current setup
      };

      // Categorize by file type
      if (upload.file_type && upload.file_type.startsWith('image/')) {
        documentsByType.images.push(doc);
      } else if (upload.file_type && (
        upload.file_type.includes('pdf') || 
        upload.file_type.includes('document') ||
        upload.file_type.includes('text')
      )) {
        documentsByType.documents.push(doc);
      } else if (upload.description && (
        upload.description.toLowerCase().includes('report') ||
        upload.description.toLowerCase().includes('test') ||
        upload.description.toLowerCase().includes('result')
      )) {
        documentsByType.reports.push(doc);
      } else {
        documentsByType.other.push(doc);
      }
    });

    // Create folder structure response
    const folderStructure = {
      totalDocuments: totalSize,
      lastUpdated: uploadsResult.rows.length > 0 ? uploadsResult.rows[0].created_at : null,
      folders: [
        {
          name: 'Medical Images',
          type: 'images',
          count: documentsByType.images.length,
          icon: '🖼️',
          documents: documentsByType.images
        },
        {
          name: 'Medical Documents',
          type: 'documents', 
          count: documentsByType.documents.length,
          icon: '📄',
          documents: documentsByType.documents
        },
        {
          name: 'Test Reports',
          type: 'reports',
          count: documentsByType.reports.length,
          icon: '📊',
          documents: documentsByType.reports
        },
        {
          name: 'Other Files',
          type: 'other',
          count: documentsByType.other.length,
          icon: '📁',
          documents: documentsByType.other
        }
      ].filter(folder => folder.count > 0), // Only show folders with documents
      allDocuments: uploadsResult.rows.map(upload => ({
        id: upload.id,
        name: upload.description || `Document ${upload.id}`,
        url: upload.file_url,
        type: upload.file_type,
        uploadDate: upload.created_at
      }))
    };

    res.json({
      message: 'Health documents folder retrieved successfully',
      folder: folderStructure
    });
  } catch (error) {
    console.error('Get health documents folder error:', error);
    res.status(500).json({ error: 'Failed to retrieve health documents folder' });
  }
};

// Delete health document
const deleteHealthDocument = async (req, res) => {
  try {
    const { documentId } = req.params;
    const userId = req.user.id;

    const result = await pool.query(
      'DELETE FROM health_uploads WHERE id = $1 AND user_id = $2 RETURNING *',
      [documentId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json({
      message: 'Health document deleted successfully',
      deletedDocument: result.rows[0]
    });
  } catch (error) {
    console.error('Delete health document error:', error);
    res.status(500).json({ error: 'Failed to delete health document' });
  }
};

const getPeriodEntries = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      'SELECT * FROM period_tracker WHERE user_id = $1 ORDER BY pain_start_date DESC',
      [userId]
    );

    res.json({
      entries: result.rows
    });
  } catch (error) {
    console.error('Get period entries error:', error);
    res.status(500).json({ error: 'Failed to retrieve period entries' });
  }
};

const getWaterIntake = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      'SELECT * FROM water_intake WHERE user_id = $1 ORDER BY date DESC',
      [userId]
    );

    res.json({
      entries: result.rows
    });
  } catch (error) {
    console.error('Get water intake error:', error);
    res.status(500).json({ error: 'Failed to retrieve water intake' });
  }
};

const getExerciseEntries = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      'SELECT * FROM exercise_tracker WHERE user_id = $1 ORDER BY date DESC',
      [userId]
    );

    res.json({
      entries: result.rows
    });
  } catch (error) {
    console.error('Get exercise entries error:', error);
    res.status(500).json({ error: 'Failed to retrieve exercise entries' });
  }
};

const getKriyaEntries = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      'SELECT * FROM shambhavi_kriya WHERE user_id = $1 ORDER BY date DESC',
      [userId]
    );

    res.json({
      entries: result.rows
    });
  } catch (error) {
    console.error('Get kriya entries error:', error);
    res.status(500).json({ error: 'Failed to retrieve kriya entries' });
  }
};

const getTypingEntries = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      'SELECT * FROM typing_practice WHERE user_id = $1 ORDER BY date DESC',
      [userId]
    );

    res.json({
      entries: result.rows
    });
  } catch (error) {
    console.error('Get typing entries error:', error);
    res.status(500).json({ error: 'Failed to retrieve typing entries' });
  }
};

const deleteExerciseEntry = async (req, res) => {
  try {
    const { exerciseId } = req.params;
    const userId = req.user.id;

    const result = await pool.query(
      'DELETE FROM exercise_tracker WHERE id = $1 AND user_id = $2 RETURNING *',
      [exerciseId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Exercise entry not found' });
    }

    res.json({
      message: 'Exercise entry deleted successfully',
      deletedEntry: result.rows[0]
    });
  } catch (error) {
    console.error('Delete exercise entry error:', error);
    res.status(500).json({ error: 'Failed to delete exercise entry' });
  }
};

const getUserStreakData = async (req, res) => {
  try {
    const { activityType } = req.params;
    const userId = req.user.id;

    const validActivityTypes = ['typing', 'kriya', 'water', 'exercise'];
    if (!validActivityTypes.includes(activityType)) {
      return res.status(400).json({ error: 'Invalid activity type' });
    }

    const result = await getUserStreak(userId, activityType);
    
    if (result.success) {
      res.json({
        message: 'Streak data retrieved successfully',
        streak: result.data
      });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    console.error('Get user streak error:', error);
    res.status(500).json({ error: 'Failed to retrieve streak data' });
  }
};

module.exports = {
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
};