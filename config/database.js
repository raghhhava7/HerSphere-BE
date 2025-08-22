const { Pool } = require('pg');
require('dotenv').config();

// Verify DATABASE_URL is loaded
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
}

// Ensure DATABASE_URL is a string and properly formatted
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is not set');
}

if (typeof databaseUrl !== 'string') {
  throw new Error('DATABASE_URL must be a string');
}

// Configure pool for Neon database with proper SSL settings
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false
  },
  // Additional connection options for Neon
  connectionTimeoutMillis: 15000,
  idleTimeoutMillis: 30000,
  max: 10,
  // Keep alive settings
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000
});

const connectDB = async (retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`🔄 Attempting to connect to Neon PostgreSQL... (Attempt ${i + 1}/${retries})`);
      
      // Test the connection
      const client = await pool.connect();
      console.log('✅ Successfully connected to Neon PostgreSQL database');
      
      // Test a simple query
      const result = await client.query('SELECT NOW() as current_time');
      console.log('✅ Database query test successful:', result.rows[0].current_time);
      
      client.release();
      return; // Success, exit the function
    } catch (error) {
      console.error(`❌ Database connection error (Attempt ${i + 1}):`, error.message);
      console.error('❌ Error code:', error.code);
      
      if (i === retries - 1) {
        // Last attempt failed
        console.error('❌ All connection attempts failed. Error details:', {
          name: error.name,
          message: error.message,
          code: error.code,
          severity: error.severity,
          detail: error.detail
        });
        console.log('⚠️  Server will continue without database connection. Some features may not work.');
        return; // Don't throw error, let server start
      } else {
        // Wait before retrying
        console.log(`⏳ Waiting 2 seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
};

// Handle pool errors
pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client:', err);
});

module.exports = { pool, connectDB };