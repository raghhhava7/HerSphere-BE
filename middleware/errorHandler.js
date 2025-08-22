const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
  }

  if (err.message && err.message.includes('Invalid file type')) {
    return res.status(400).json({ error: err.message });
  }

  // Database errors
  if (err.code === '23505') { // Unique constraint violation
    return res.status(400).json({ error: 'Duplicate entry. Record already exists.' });
  }

  if (err.code === '23503') { // Foreign key constraint violation
    return res.status(400).json({ error: 'Invalid reference. Related record not found.' });
  }

  if (err.code === '23514') { // Check constraint violation
    return res.status(400).json({ error: 'Invalid data. Please check your input values.' });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Invalid token' });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Token expired' });
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }

  // Default error
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = errorHandler;