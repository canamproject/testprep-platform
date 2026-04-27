#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting TestPrep Platform...');

// Check if we're in Railway
const isRailway = process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_SERVICE_NAME;

if (isRailway) {
  console.log('📍 Railway environment detected');
  
  // Try to get MySQL connection info from Railway
  if (!process.env.DATABASE_URL && !process.env.MYSQL_URL) {
    console.log('⚠️  DATABASE_URL not set, checking for MySQL service...');
    
    // Railway should auto-provide this, but let's wait a moment
    console.log('⏳ Waiting for database connection...');
  }
}

// Start the server
console.log('🟢 Starting server...');
require('./index.js');
