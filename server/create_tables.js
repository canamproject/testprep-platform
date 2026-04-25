const mysql = require('mysql2/promise');

const tables = [
  // Table 1: batches
  `CREATE TABLE IF NOT EXISTS batches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    agency_id INT NOT NULL,
    course_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE,
    schedule_days VARCHAR(50) DEFAULT 'Mon,Tue,Wed,Thu,Fri',
    class_time TIME NOT NULL,
    duration_minutes INT DEFAULT 60,
    timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
    trainer_id INT,
    trainer_name VARCHAR(255),
    jitsi_room_prefix VARCHAR(100),
    jitsi_meeting_id VARCHAR(255),
    status ENUM('draft','active','paused','completed','cancelled') DEFAULT 'draft',
    max_students INT DEFAULT 20,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (agency_id) REFERENCES agencies(id),
    FOREIGN KEY (course_id) REFERENCES courses(id),
    FOREIGN KEY (trainer_id) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_batches_agency (agency_id),
    INDEX idx_batches_course (course_id),
    INDEX idx_batches_status (status)
  )`,

  // Table 2: lessons
  `CREATE TABLE IF NOT EXISTS lessons (
    id INT AUTO_INCREMENT PRIMARY KEY,
    course_id INT NOT NULL,
    module_name VARCHAR(255),
    lesson_order INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    content_type ENUM('video','live_class','quiz','assignment','document') DEFAULT 'video',
    video_url VARCHAR(500),
    video_duration_minutes INT DEFAULT 0,
    linked_live_class_id INT,
    is_published TINYINT(1) DEFAULT 0,
    is_mandatory TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id),
    INDEX idx_lessons_course (course_id),
    INDEX idx_lessons_order (course_id, lesson_order)
  )`,

  // Table 3: live_classes
  `CREATE TABLE IF NOT EXISTS live_classes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    batch_id INT NOT NULL,
    agency_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    lesson_id INT,
    scheduled_at DATETIME NOT NULL,
    duration_minutes INT DEFAULT 60,
    timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
    jitsi_room_name VARCHAR(255) NOT NULL,
    jitsi_meeting_url VARCHAR(500),
    jitsi_moderator_url VARCHAR(500),
    class_mode ENUM('interactive','broadcast') DEFAULT 'interactive',
    allow_student_video TINYINT(1) DEFAULT 1,
    allow_student_audio TINYINT(1) DEFAULT 1,
    allow_chat TINYINT(1) DEFAULT 1,
    allow_screen_share TINYINT(1) DEFAULT 1,
    allow_raise_hand TINYINT(1) DEFAULT 1,
    auto_record TINYINT(1) DEFAULT 0,
    recording_url VARCHAR(500),
    recording_duration INT,
    recording_file_size BIGINT,
    recording_stored_at TIMESTAMP,
    status ENUM('scheduled','live','ended','cancelled','recorded') DEFAULT 'scheduled',
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES batches(id),
    FOREIGN KEY (agency_id) REFERENCES agencies(id),
    FOREIGN KEY (lesson_id) REFERENCES lessons(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_live_classes_batch (batch_id),
    INDEX idx_live_classes_scheduled (scheduled_at),
    INDEX idx_live_classes_status (status)
  )`,

  // Add FK to lessons for live_classes
  `ALTER TABLE lessons 
   ADD CONSTRAINT IF NOT EXISTS fk_lessons_live_class 
   FOREIGN KEY (linked_live_class_id) REFERENCES live_classes(id) ON DELETE SET NULL`,

  // Table 4: batch_enrollments
  `CREATE TABLE IF NOT EXISTS batch_enrollments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    batch_id INT NOT NULL,
    student_id INT NOT NULL,
    enrollment_id INT NOT NULL,
    access_type ENUM('full','demo','trial') DEFAULT 'full',
    demo_expires_at TIMESTAMP,
    status ENUM('active','completed','dropped','suspended') DEFAULT 'active',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_batch_student (batch_id, student_id),
    FOREIGN KEY (batch_id) REFERENCES batches(id),
    FOREIGN KEY (student_id) REFERENCES users(id),
    FOREIGN KEY (enrollment_id) REFERENCES enrollments(id),
    INDEX idx_batch_enrollments_batch (batch_id),
    INDEX idx_batch_enrollments_student (student_id)
  )`,

  // Table 5: class_attendance
  `CREATE TABLE IF NOT EXISTS class_attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    live_class_id INT NOT NULL,
    student_id INT NOT NULL,
    batch_id INT NOT NULL,
    joined_at TIMESTAMP,
    left_at TIMESTAMP,
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
    FOREIGN KEY (batch_id) REFERENCES batches(id),
    INDEX idx_class_attendance_live_class (live_class_id),
    INDEX idx_class_attendance_student (student_id)
  )`,

  // Table 6: progress_tracking
  `CREATE TABLE IF NOT EXISTS progress_tracking (
    id INT AUTO_INCREMENT PRIMARY KEY,
    enrollment_id INT NOT NULL,
    student_id INT NOT NULL,
    course_id INT NOT NULL,
    lesson_id INT NOT NULL,
    video_watched_seconds INT DEFAULT 0,
    video_total_seconds INT DEFAULT 0,
    video_completion_percent INT DEFAULT 0,
    last_watched_at TIMESTAMP,
    status ENUM('not_started','in_progress','completed','locked') DEFAULT 'not_started',
    quiz_score INT,
    max_quiz_score INT,
    assignment_score INT,
    max_assignment_score INT,
    time_spent_minutes INT DEFAULT 0,
    first_accessed_at TIMESTAMP,
    completed_at TIMESTAMP,
    student_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_enrollment_lesson (enrollment_id, lesson_id),
    FOREIGN KEY (enrollment_id) REFERENCES enrollments(id),
    FOREIGN KEY (student_id) REFERENCES users(id),
    FOREIGN KEY (course_id) REFERENCES courses(id),
    FOREIGN KEY (lesson_id) REFERENCES lessons(id),
    INDEX idx_progress_enrollment (enrollment_id),
    INDEX idx_progress_student (student_id),
    INDEX idx_progress_course (course_id)
  )`,

  // Table 7: demo_access_requests
  `CREATE TABLE IF NOT EXISTS demo_access_requests (
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
    converted_at TIMESTAMP,
    preferred_demo_date DATE,
    scheduled_demo_class_id INT,
    source VARCHAR(100),
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP,
    approved_by INT,
    FOREIGN KEY (agency_id) REFERENCES agencies(id),
    FOREIGN KEY (course_id) REFERENCES courses(id),
    FOREIGN KEY (demo_batch_id) REFERENCES batches(id),
    FOREIGN KEY (scheduled_demo_class_id) REFERENCES live_classes(id),
    FOREIGN KEY (converted_to_enrollment_id) REFERENCES enrollments(id),
    FOREIGN KEY (approved_by) REFERENCES users(id),
    INDEX idx_demo_requests_agency (agency_id),
    INDEX idx_demo_requests_status (status),
    INDEX idx_demo_requests_email (email)
  )`,

  // Table 8: demo_users
  `CREATE TABLE IF NOT EXISTS demo_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    demo_request_id INT NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    access_starts_at TIMESTAMP NOT NULL,
    access_expires_at TIMESTAMP NOT NULL,
    is_active TINYINT(1) DEFAULT 1,
    last_login_at TIMESTAMP,
    login_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (demo_request_id) REFERENCES demo_access_requests(id)
  )`,

  // Table 9: jitsi_tokens
  `CREATE TABLE IF NOT EXISTS jitsi_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    live_class_id INT NOT NULL,
    user_id INT NOT NULL,
    token VARCHAR(512) NOT NULL,
    token_type ENUM('moderator','participant') DEFAULT 'participant',
    issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    is_used TINYINT(1) DEFAULT 0,
    is_revoked TINYINT(1) DEFAULT 0,
    FOREIGN KEY (live_class_id) REFERENCES live_classes(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`
];

async function createTables() {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'testprep_platform',
    multipleStatements: true
  });

  console.log('🚀 Creating database tables for Live Classes...\n');
  const created = [];
  const errors = [];

  for (let i = 0; i < tables.length; i++) {
    try {
      await pool.query(tables[i]);
      const tableName = tables[i].match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1] || 
                        tables[i].match(/ALTER TABLE (\w+)/)?.[1] || 
                        `Step ${i+1}`;
      created.push(tableName);
      console.log(`  ✓ ${tableName}`);
    } catch (err) {
      errors.push({ step: i+1, error: err.message });
      console.log(`  ❌ Step ${i+1}: ${err.message.substring(0, 80)}...`);
    }
  }

  console.log('\n📊 Summary:');
  console.log(`  Tables created: ${created.length}`);
  if (errors.length > 0) {
    console.log(`  Errors: ${errors.length}`);
    errors.forEach(e => console.log(`    - Step ${e.step}: ${e.error.substring(0, 100)}`));
  }

  // Show all tables
  const [allTables] = await pool.query(`
    SELECT TABLE_NAME FROM information_schema.TABLES 
    WHERE TABLE_SCHEMA = 'testprep_platform'
    ORDER BY TABLE_NAME
  `);
  
  console.log('\n📋 All tables in database:');
  allTables.forEach(t => {
    const isNew = created.includes(t.TABLE_NAME);
    console.log(`  ${isNew ? '✓' : '•'} ${t.TABLE_NAME}`);
  });

  await pool.end();
  console.log('\n🎉 Migration complete!');
}

createTables().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
