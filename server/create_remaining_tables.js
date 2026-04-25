const mysql = require('mysql2/promise');

async function createRemainingTables() {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'testprep_platform'
  });

  const tables = [
    {
      name: 'demo_access_requests',
      sql: `CREATE TABLE IF NOT EXISTS demo_access_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        agency_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        course_id INT,
        course_category ENUM('IELTS','PTE','TOEFL','GERMAN','FRENCH','SPOKEN_ENGLISH','OTHER'),
        demo_batch_id INT,
        demo_duration_hours INT DEFAULT 48,
        status ENUM('pending','approved','active','expired','rejected','converted') DEFAULT 'pending',
        converted_to_enrollment_id INT,
        converted_at TIMESTAMP NULL,
        preferred_demo_date DATE,
        scheduled_demo_class_id INT,
        source VARCHAR(100),
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        approved_at TIMESTAMP NULL,
        approved_by INT,
        FOREIGN KEY (agency_id) REFERENCES agencies(id),
        FOREIGN KEY (course_id) REFERENCES courses(id),
        FOREIGN KEY (demo_batch_id) REFERENCES batches(id),
        FOREIGN KEY (scheduled_demo_class_id) REFERENCES live_classes(id),
        FOREIGN KEY (converted_to_enrollment_id) REFERENCES enrollments(id),
        FOREIGN KEY (approved_by) REFERENCES users(id)
      )`
    },
    {
      name: 'progress_tracking',
      sql: `CREATE TABLE IF NOT EXISTS progress_tracking (
        id INT AUTO_INCREMENT PRIMARY KEY,
        enrollment_id INT NOT NULL,
        student_id INT NOT NULL,
        course_id INT NOT NULL,
        lesson_id INT NOT NULL,
        video_watched_seconds INT DEFAULT 0,
        video_total_seconds INT DEFAULT 0,
        video_completion_percent INT DEFAULT 0,
        last_watched_at TIMESTAMP NULL,
        status ENUM('not_started','in_progress','completed','locked') DEFAULT 'not_started',
        quiz_score INT,
        max_quiz_score INT,
        assignment_score INT,
        max_assignment_score INT,
        time_spent_minutes INT DEFAULT 0,
        first_accessed_at TIMESTAMP NULL,
        completed_at TIMESTAMP NULL,
        student_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_enrollment_lesson (enrollment_id, lesson_id),
        FOREIGN KEY (enrollment_id) REFERENCES enrollments(id),
        FOREIGN KEY (student_id) REFERENCES users(id),
        FOREIGN KEY (course_id) REFERENCES courses(id),
        FOREIGN KEY (lesson_id) REFERENCES lessons(id)
      )`
    },
    {
      name: 'class_attendance',
      sql: `CREATE TABLE IF NOT EXISTS class_attendance (
        id INT AUTO_INCREMENT PRIMARY KEY,
        live_class_id INT NOT NULL,
        student_id INT NOT NULL,
        batch_id INT NOT NULL,
        joined_at TIMESTAMP NULL,
        left_at TIMESTAMP NULL,
        duration_seconds INT DEFAULT 0,
        time_in_class_percent INT DEFAULT 0,
        messages_sent INT DEFAULT 0,
        hand_raised_count INT DEFAULT 0,
        screen_shared_seconds INT DEFAULT 0,
        camera_on_seconds INT DEFAULT 0,
        mic_used_seconds INT DEFAULT 0,
        attendance_status ENUM('present','partial','absent','late','left_early') DEFAULT 'absent',
        device_type ENUM('desktop','mobile','tablet') DEFAULT 'desktop',
        browser VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_class_student (live_class_id, student_id),
        FOREIGN KEY (live_class_id) REFERENCES live_classes(id),
        FOREIGN KEY (student_id) REFERENCES users(id),
        FOREIGN KEY (batch_id) REFERENCES batches(id)
      )`
    },
    {
      name: 'demo_users',
      sql: `CREATE TABLE IF NOT EXISTS demo_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        demo_request_id INT NOT NULL,
        email VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        access_starts_at TIMESTAMP NULL,
        access_expires_at TIMESTAMP NULL,
        is_active TINYINT(1) DEFAULT 1,
        last_login_at TIMESTAMP NULL,
        login_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (demo_request_id) REFERENCES demo_access_requests(id)
      )`
    },
    {
      name: 'jitsi_tokens',
      sql: `CREATE TABLE IF NOT EXISTS jitsi_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        live_class_id INT NOT NULL,
        user_id INT NOT NULL,
        token VARCHAR(512) NOT NULL,
        token_type ENUM('moderator','participant') DEFAULT 'participant',
        issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NULL,
        used_at TIMESTAMP NULL,
        is_used TINYINT(1) DEFAULT 0,
        is_revoked TINYINT(1) DEFAULT 0,
        FOREIGN KEY (live_class_id) REFERENCES live_classes(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`
    }
  ];

  console.log('Creating remaining tables...\n');

  for (const table of tables) {
    try {
      await pool.query(table.sql);
      console.log(`  ✓ ${table.name}`);
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log(`  ℹ️  ${table.name} (already exists)`);
      } else {
        console.log(`  ❌ ${table.name}: ${err.message.substring(0, 100)}`);
      }
    }
  }

  // Show final table list
  const [allTables] = await pool.query(`
    SELECT TABLE_NAME FROM information_schema.TABLES 
    WHERE TABLE_SCHEMA = 'testprep_platform'
    AND TABLE_NAME IN ('batches', 'lessons', 'live_classes', 'batch_enrollments', 'class_attendance', 'progress_tracking', 'demo_access_requests', 'demo_users', 'jitsi_tokens')
    ORDER BY TABLE_NAME
  `);

  console.log('\n📋 Live Class tables:');
  allTables.forEach(t => console.log(`  ✓ ${t.TABLE_NAME}`));

  if (allTables.length === 9) {
    console.log('\n🎉 All 9 tables created successfully!');
  } else {
    console.log(`\n⚠️  Expected 9 tables, found ${allTables.length}`);
  }

  await pool.end();
}

createRemainingTables().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
