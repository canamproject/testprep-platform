-- ============================================================
-- TestPrepGPT Live Classes + Progress Tracking Migration
-- Run after schema.sql: mysql -u root testprep_platform < live_classes_migration.sql
-- ============================================================

USE testprep_platform;

-- ============================================================
-- BATCHES (Course cohorts/groups with schedule)
-- ============================================================
CREATE TABLE IF NOT EXISTS batches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  agency_id INT NOT NULL,
  course_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Schedule Configuration
  start_date DATE NOT NULL,
  end_date DATE,
  schedule_days SET('Mon','Tue','Wed','Thu','Fri','Sat','Sun') DEFAULT 'Mon,Tue,Wed,Thu,Fri',
  class_time TIME NOT NULL,
  duration_minutes INT DEFAULT 60,
  timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
  
  -- Trainer Assignment
  trainer_id INT,
  trainer_name VARCHAR(255),
  
  -- Jitsi Configuration
  jitsi_room_prefix VARCHAR(100),  -- e.g., "brightpath-ielts-batch1"
  jitsi_meeting_id VARCHAR(255),   -- unique room identifier
  
  -- Status
  status ENUM('draft','active','paused','completed','cancelled') DEFAULT 'draft',
  max_students INT DEFAULT 20,
  
  -- Metadata
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (agency_id) REFERENCES agencies(id),
  FOREIGN KEY (course_id) REFERENCES courses(id),
  FOREIGN KEY (trainer_id) REFERENCES users(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- ============================================================
-- LESSONS (Course content breakdown - modules & lessons)
-- ============================================================
CREATE TABLE IF NOT EXISTS lessons (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT NOT NULL,
  
  -- Hierarchy
  module_name VARCHAR(255),           -- e.g., "Module 1: Reading Skills"
  lesson_order INT NOT NULL,          -- ordering within course
  
  -- Content
  title VARCHAR(255) NOT NULL,
  description TEXT,
  content_type ENUM('video','live_class','quiz','assignment','document') DEFAULT 'video',
  
  -- Video Content (for recorded lessons)
  video_url VARCHAR(500),
  video_duration_minutes INT DEFAULT 0,
  
  -- Linked Live Class (if content_type = live_class) - FK added after live_classes created
  linked_live_class_id INT,
  
  -- Status
  is_published TINYINT(1) DEFAULT 0,
  is_mandatory TINYINT(1) DEFAULT 1,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (course_id) REFERENCES courses(id)
);

-- ============================================================
-- LIVE CLASSES (Individual scheduled sessions)
-- ============================================================
CREATE TABLE IF NOT EXISTS live_classes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  batch_id INT NOT NULL,
  agency_id INT NOT NULL,
  
  -- Session Details
  title VARCHAR(255) NOT NULL,
  description TEXT,
  lesson_id INT,                      -- link to lesson if applicable
  
  -- Schedule
  scheduled_at DATETIME NOT NULL,
  duration_minutes INT DEFAULT 60,
  timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
  
  -- Jitsi Configuration
  jitsi_room_name VARCHAR(255) NOT NULL,  -- unique room name
  jitsi_meeting_url VARCHAR(500),          -- full meeting URL
  jitsi_moderator_url VARCHAR(500),      -- host/moderator URL
  
  -- Class Settings
  class_mode ENUM('interactive','broadcast') DEFAULT 'interactive',
  allow_student_video TINYINT(1) DEFAULT 1,
  allow_student_audio TINYINT(1) DEFAULT 1,
  allow_chat TINYINT(1) DEFAULT 1,
  allow_screen_share TINYINT(1) DEFAULT 1,
  allow_raise_hand TINYINT(1) DEFAULT 1,
  
  -- Recording
  auto_record TINYINT(1) DEFAULT 0,
  recording_url VARCHAR(500),
  recording_duration INT,              -- seconds
  recording_file_size BIGINT,          -- bytes
  recording_stored_at TIMESTAMP,
  
  -- Status
  status ENUM('scheduled','live','ended','cancelled','recorded') DEFAULT 'scheduled',
  
  -- Metadata
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  started_at TIMESTAMP NULL,
  ended_at TIMESTAMP NULL,
  
  FOREIGN KEY (batch_id) REFERENCES batches(id),
  FOREIGN KEY (agency_id) REFERENCES agencies(id),
  FOREIGN KEY (lesson_id) REFERENCES lessons(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Add FK to lessons table (after live_classes exists)
ALTER TABLE lessons ADD CONSTRAINT IF NOT EXISTS fk_lessons_live_class 
  FOREIGN KEY (linked_live_class_id) REFERENCES live_classes(id) ON DELETE SET NULL;

-- ============================================================
-- BATCH ENROLLMENTS (Students assigned to batches)
-- ============================================================
CREATE TABLE IF NOT EXISTS batch_enrollments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  batch_id INT NOT NULL,
  student_id INT NOT NULL,
  enrollment_id INT NOT NULL,          -- link to main enrollments table
  
  -- Access Control
  access_type ENUM('full','demo','trial') DEFAULT 'full',
  demo_expires_at TIMESTAMP NULL,      -- for demo access
  
  -- Status
  status ENUM('active','completed','dropped','suspended') DEFAULT 'active',
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE KEY unique_batch_student (batch_id, student_id),
  
  FOREIGN KEY (batch_id) REFERENCES batches(id),
  FOREIGN KEY (student_id) REFERENCES users(id),
  FOREIGN KEY (enrollment_id) REFERENCES enrollments(id)
);

-- ============================================================
-- CLASS ATTENDANCE (Track who attended live sessions)
-- ============================================================
CREATE TABLE IF NOT EXISTS class_attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  live_class_id INT NOT NULL,
  student_id INT NOT NULL,
  batch_id INT NOT NULL,
  
  -- Attendance Details
  joined_at TIMESTAMP,
  left_at TIMESTAMP,
  duration_seconds INT DEFAULT 0,
  
  -- Participation Metrics
  time_in_class_percent INT DEFAULT 0,  -- % of total class time
  messages_sent INT DEFAULT 0,
  hand_raised_count INT DEFAULT 0,
  screen_shared_seconds INT DEFAULT 0,
  camera_on_seconds INT DEFAULT 0,
  mic_used_seconds INT DEFAULT 0,
  
  -- Status
  attendance_status ENUM('present','partial','absent','late','left_early') DEFAULT 'absent',
  
  -- Device Info (for analytics)
  device_type ENUM('desktop','mobile','tablet') DEFAULT 'desktop',
  browser VARCHAR(100),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY unique_class_student (live_class_id, student_id),
  
  FOREIGN KEY (live_class_id) REFERENCES live_classes(id),
  FOREIGN KEY (student_id) REFERENCES users(id),
  FOREIGN KEY (batch_id) REFERENCES batches(id)
);

-- ============================================================
-- PROGRESS TRACKING (Detailed lesson-level progress)
-- ============================================================
CREATE TABLE IF NOT EXISTS progress_tracking (
  id INT AUTO_INCREMENT PRIMARY KEY,
  enrollment_id INT NOT NULL,
  student_id INT NOT NULL,
  course_id INT NOT NULL,
  lesson_id INT NOT NULL,
  
  -- Video Progress (for recorded content)
  video_watched_seconds INT DEFAULT 0,
  video_total_seconds INT DEFAULT 0,
  video_completion_percent INT DEFAULT 0,
  last_watched_at TIMESTAMP,
  
  -- Lesson Status
  status ENUM('not_started','in_progress','completed','locked') DEFAULT 'not_started',
  
  -- Scores (for quizzes/assignments)
  quiz_score INT,
  max_quiz_score INT,
  assignment_score INT,
  max_assignment_score INT,
  
  -- Time Tracking
  time_spent_minutes INT DEFAULT 0,
  first_accessed_at TIMESTAMP,
  completed_at TIMESTAMP,
  
  -- Notes
  student_notes TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY unique_enrollment_lesson (enrollment_id, lesson_id),
  
  FOREIGN KEY (enrollment_id) REFERENCES enrollments(id),
  FOREIGN KEY (student_id) REFERENCES users(id),
  FOREIGN KEY (course_id) REFERENCES courses(id),
  FOREIGN KEY (lesson_id) REFERENCES lessons(id)
);

-- ============================================================
-- DEMO ACCESS REQUESTS (Demo user management)
-- ============================================================
CREATE TABLE IF NOT EXISTS demo_access_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  agency_id INT NOT NULL,
  
  -- Requester Details
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  
  -- Interest
  course_id INT,
  course_category ENUM('IELTS','PTE','TOEFL','GERMAN','FRENCH','SPOKEN_ENGLISH','OTHER'),
  
  -- Demo Configuration
  demo_batch_id INT,                    -- assigned demo batch
  demo_duration_hours INT DEFAULT 48,   -- default 2 days
  
  -- Status
  status ENUM('pending','approved','active','expired','rejected','converted') DEFAULT 'pending',
  
  -- If converted to full enrollment
  converted_to_enrollment_id INT,
  converted_at TIMESTAMP,
  
  -- Scheduling
  preferred_demo_date DATE,
  scheduled_demo_class_id INT,          -- specific class they're invited to
  
  -- Metadata
  source VARCHAR(100),                  -- 'website', 'landing_page', 'referral'
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
  FOREIGN KEY (approved_by) REFERENCES users(id)
);

-- ============================================================
-- DEMO USERS (Temporary user accounts for demos)
-- ============================================================
CREATE TABLE IF NOT EXISTS demo_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  demo_request_id INT NOT NULL,
  
  -- Credentials (auto-generated)
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  
  -- Access Window
  access_starts_at TIMESTAMP NOT NULL,
  access_expires_at TIMESTAMP NOT NULL,
  
  -- Current Status
  is_active TINYINT(1) DEFAULT 1,
  last_login_at TIMESTAMP,
  login_count INT DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (demo_request_id) REFERENCES demo_access_requests(id)
);

-- ============================================================
-- JITSI TOKENS (For secure room access)
-- ============================================================
CREATE TABLE IF NOT EXISTS jitsi_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  live_class_id INT NOT NULL,
  user_id INT NOT NULL,
  
  -- Token Details
  token VARCHAR(512) NOT NULL,
  token_type ENUM('moderator','participant') DEFAULT 'participant',
  
  -- Validity
  issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  
  -- Status
  is_used TINYINT(1) DEFAULT 0,
  is_revoked TINYINT(1) DEFAULT 0,
  
  FOREIGN KEY (live_class_id) REFERENCES live_classes(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ============================================================
-- INDEXES for Performance
-- ============================================================
CREATE INDEX idx_batches_agency ON batches(agency_id);
CREATE INDEX idx_batches_course ON batches(course_id);
CREATE INDEX idx_batches_status ON batches(status);

CREATE INDEX idx_lessons_course ON lessons(course_id);
CREATE INDEX idx_lessons_order ON lessons(course_id, lesson_order);

CREATE INDEX idx_live_classes_batch ON live_classes(batch_id);
CREATE INDEX idx_live_classes_scheduled ON live_classes(scheduled_at);
CREATE INDEX idx_live_classes_status ON live_classes(status);

CREATE INDEX idx_batch_enrollments_batch ON batch_enrollments(batch_id);
CREATE INDEX idx_batch_enrollments_student ON batch_enrollments(student_id);

CREATE INDEX idx_class_attendance_live_class ON class_attendance(live_class_id);
CREATE INDEX idx_class_attendance_student ON class_attendance(student_id);

CREATE INDEX idx_progress_enrollment ON progress_tracking(enrollment_id);
CREATE INDEX idx_progress_student ON progress_tracking(student_id);
CREATE INDEX idx_progress_course ON progress_tracking(course_id);

CREATE INDEX idx_demo_requests_agency ON demo_access_requests(agency_id);
CREATE INDEX idx_demo_requests_status ON demo_access_requests(status);
CREATE INDEX idx_demo_requests_email ON demo_access_requests(email);

-- ============================================================
-- SEED DATA (Optional - for testing)
-- ============================================================

-- Create a demo batch for BrightPath (agency_id=1) with IELTS course (course_id=1)
INSERT INTO batches (
  agency_id, course_id, name, description, 
  start_date, end_date, schedule_days, class_time, duration_minutes,
  trainer_name, jitsi_room_prefix, status, max_students, created_by
) 
SELECT 
  1, 1, 'IELTS Academic - April 2025 Batch', 'Morning batch for IELTS Academic preparation with live classes Mon-Fri',
  '2025-04-01', '2025-05-15', 'Mon,Tue,Wed,Thu,Fri', '09:00:00', 90,
  'Priya Sharma (Senior Trainer)', 'brightpath-ielts-apr2025', 'active', 15, 
  (SELECT id FROM users WHERE role='super_admin' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM batches WHERE agency_id=1 AND course_id=1);

-- Create lessons for IELTS course (if not exist)
INSERT INTO lessons (course_id, module_name, lesson_order, title, description, content_type, is_published, is_mandatory)
SELECT 1, 'Module 1: Listening Skills', 1, 'Listening Overview & Strategies', 'Introduction to IELTS listening section with key strategies', 'video', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM lessons WHERE course_id=1 AND lesson_order=1);

INSERT INTO lessons (course_id, module_name, lesson_order, title, description, content_type, is_published, is_mandatory)
SELECT 1, 'Module 1: Listening Skills', 2, 'Listening Practice Test 1', 'Live practice session with real IELTS listening test', 'live_class', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM lessons WHERE course_id=1 AND lesson_order=2);

COMMIT;
