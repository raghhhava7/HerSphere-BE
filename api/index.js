// Vercel serverless function entry point
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { connectDB } = require('../config/database');
const { initializeDatabase } = require('../config/initDb');
const errorHandler = require('../middleware/errorHandler');

const app = express();

// Middleware
app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/auth', require('../routes/auth'));
app.use('/profile', require('../routes/profile'));
app.use('/health', require('../routes/health'));
app.use('/education', require('../routes/education'));
app.use('/logs', require('../routes/logs'));
app.use('/notifications', require('../routes/notifications'));
app.use('/analytics', require('../routes/analytics'));
app.use('/streaks', require('../routes/streaks'));

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'HerSphere API - Deployed on Vercel',
    status: 'running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production'
  });
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Initialize database connection (for serverless)
let dbInitialized = false;

const initializeIfNeeded = async () => {
  if (!dbInitialized) {
    try {
      await connectDB();
      await initializeDatabase();
      dbInitialized = true;
      console.log('✅ Database initialized for serverless function');
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
    }
  }
};

// Serverless function handler
module.exports = async (req, res) => {
  await initializeIfNeeded();
  return app(req, res);
};