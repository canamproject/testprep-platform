const fs = require('fs');
const mysql = require('mysql2/promise');
const path = require('path');

async function runMigration() {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'testprep_platform',
    multipleStatements: true
  });

  try {
    const sqlFile = path.join(__dirname, 'live_classes_migration.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    console.log('Running migration...');
    await pool.query(sql);
    console.log('✅ Migration completed successfully!');
    
    // Verify tables were created
    const [tables] = await pool.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = 'testprep_platform' 
      AND TABLE_NAME IN ('batches', 'lessons', 'live_classes', 'batch_enrollments', 'class_attendance', 'progress_tracking', 'demo_access_requests', 'demo_users', 'jitsi_tokens')
    `);
    
    console.log('\n📋 Created tables:');
    tables.forEach(t => console.log(`  ✓ ${t.TABLE_NAME}`));
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
