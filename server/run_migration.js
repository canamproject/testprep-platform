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
    const sqlFile = path.join(__dirname, '..', 'database', 'live_classes_migration.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    console.log('🚀 Running database migration...');
    await pool.query(sql);
    console.log('✅ Migration completed successfully!\n');
    
    // Verify tables were created
    const [tables] = await pool.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = 'testprep_platform' 
      AND TABLE_NAME IN ('batches', 'lessons', 'live_classes', 'batch_enrollments', 'class_attendance', 'progress_tracking', 'demo_access_requests', 'demo_users', 'jitsi_tokens')
      ORDER BY TABLE_NAME
    `);
    
    console.log('📋 Created tables:');
    tables.forEach(t => console.log(`  ✓ ${t.TABLE_NAME}`));
    
    if (tables.length === 9) {
      console.log('\n🎉 All 9 tables created successfully!');
    } else {
      console.log(`\n⚠️  Expected 9 tables, found ${tables.length}`);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
    if (error.message.includes('Duplicate')) {
      console.log('\n💡 Tables may already exist. This is safe to ignore.');
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
