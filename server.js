// Load environment variables FIRST
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { connectDB } = require('./config/database');
const { initializeDatabase } = require('./config/initDb');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Middleware
app.use(cors({
  origin: '*', // Allow all origins as requested by user
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/auth', require('./routes/auth'));
app.use('/profile', require('./routes/profile'));
app.use('/health', require('./routes/health'));
app.use('/education', require('./routes/education'));
app.use('/logs', require('./routes/logs'));
app.use('/notifications', require('./routes/notifications'));
app.use('/analytics', require('./routes/analytics'));
app.use('/streaks', require('./routes/streaks'));

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Personal Health & Study Management API',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 3000;

// Initialize database and start server
const startServer = async () => {
  try {
    // Connect to database first
    await connectDB();
    console.log('✅ Database connected successfully');

    // Initialize database tables
    await initializeDatabase();
    console.log('✅ Database initialized successfully');

    // Start the server on all interfaces for better connectivity
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`🌐 Server URL: http://localhost:${PORT}`);
      console.log(`📱 Mobile URL: http://10.37.63.88:${PORT}`);
      console.log(`🤖 Android Emulator URL: http://10.0.2.2:${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV}`);
      console.log(`🎯 API ready for requests!`);
      console.log(`🔗 Testing connectivity...`);

      // Test server connectivity
      setTimeout(() => {
        console.log(`✅ Server is accessible and ready for mobile connections`);
      }, 1000);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
        process.exit(1);
      } else {
        console.error('❌ Server error:', err);
      }
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT. Server shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM. Server shutting down gracefully...');
  process.exit(0);
});

// Prevent the process from exiting unexpectedly
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  // Don't exit the process, just log the error
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process, just log the error
});

module.exports = app;