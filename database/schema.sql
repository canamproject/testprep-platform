-- ============================================================
-- TestPrepGPT White-Label Middleware Platform - MySQL Schema
-- Run this file in MySQL: mysql -u root -p < schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS testprep_platform CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE testprep_platform;

-- ============================================================
-- AGENCIES (Partners / Tenants)
-- ============================================================
CREATE TABLE IF NOT EXISTS agencies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,        -- used in URL: /agent/brightpath
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  city VARCHAR(100),
  brand_color VARCHAR(10) DEFAULT '#1e40af',
  logo_initials VARCHAR(5),
  commission_rate DECIMAL(5,2) DEFAULT 60.00, -- partner % (rest goes to platform)
  status ENUM('active','pending','suspended') DEFAULT 'active',
  lms_api_key VARCHAR(255),                  -- for LMS SSO (hidden)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- USERS (Admin / Partner Admin / Students)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('super_admin','partner_admin','student') NOT NULL,
  agency_id INT,
  phone VARCHAR(20),
  lms_user_id VARCHAR(100),               -- mapped LMS user ID (hidden from student)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE SET NULL
);

-- ============================================================
-- COURSES (Products sold to students)
-- ============================================================
CREATE TABLE IF NOT EXISTS courses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  category ENUM('IELTS','PTE','TOEFL','GERMAN','FRENCH','SPOKEN_ENGLISH','OTHER') NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  duration_weeks INT DEFAULT 12,
  lms_course_id VARCHAR(100),              -- maps to LMS course (hidden)
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- ENROLLMENTS (Student buys course via an agency)
-- ============================================================
CREATE TABLE IF NOT EXISTS enrollments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  agency_id INT NOT NULL,
  course_id INT NOT NULL,
  fee_paid DECIMAL(10,2) NOT NULL,
  payment_status ENUM('paid','pending','refunded') DEFAULT 'pending',
  payment_date DATE,
  coupon_code VARCHAR(50),
  discount_amount DECIMAL(10,2) DEFAULT 0,
  lms_enrolled TINYINT(1) DEFAULT 0,       -- whether pushed to LMS
  sso_token VARCHAR(512),                  -- JWT for LMS access
  progress_percent INT DEFAULT 0,
  status ENUM('active','completed','cancelled','on_hold') DEFAULT 'active',
  enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES users(id),
  FOREIGN KEY (agency_id) REFERENCES agencies(id),
  FOREIGN KEY (course_id) REFERENCES courses(id)
);

-- ============================================================
-- COMMISSION PAYOUTS
-- ============================================================
CREATE TABLE IF NOT EXISTS payouts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  agency_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  eligible_students INT DEFAULT 0,
  status ENUM('pending','approved','paid','rejected') DEFAULT 'pending',
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP NULL,
  admin_note TEXT,
  FOREIGN KEY (agency_id) REFERENCES agencies(id)
);

-- ============================================================
-- COUPONS
-- ============================================================
CREATE TABLE IF NOT EXISTS coupons (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  agency_id INT NOT NULL,
  discount_type ENUM('percentage','fixed') DEFAULT 'percentage',
  value DECIMAL(10,2) NOT NULL,
  min_order DECIMAL(10,2) DEFAULT 0,
  max_uses INT DEFAULT 100,
  used_count INT DEFAULT 0,
  expires_at DATE,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agency_id) REFERENCES agencies(id)
);

-- ============================================================
-- CRM LEADS
-- ============================================================
CREATE TABLE IF NOT EXISTS leads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  agency_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  course_interest VARCHAR(100),
  status ENUM('new','contacted','demo_done','enrolled','lost') DEFAULT 'new',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (agency_id) REFERENCES agencies(id)
);

-- ============================================================
-- SEED DATA
-- ============================================================

-- 3 Agencies
INSERT INTO agencies (name, slug, email, phone, city, brand_color, logo_initials, commission_rate, status) VALUES
('BrightPath Academy',     'brightpath', 'admin@brightpath.in',   '+91-9876543200', 'Mumbai',    '#1e40af', 'BP', 60.00, 'active'),
('GlobalVisa Consultants', 'globalvisa', 'ops@globalvisa.com',    '+91-9765432100', 'Delhi',     '#0f766e', 'GV', 65.00, 'active'),
('EduStar Institute',      'edustar',    'info@edustar.co',       '+91-9654321000', 'Bangalore', '#7c3aed', 'ES', 55.00, 'active');

-- Courses (different types per agency context)
INSERT INTO courses (title, category, description, price, duration_weeks, lms_course_id) VALUES
('IELTS Academic Masterclass',     'IELTS',          'Complete IELTS Academic preparation with mock tests and expert feedback', 14999, 12, 'lms_course_101'),
('IELTS General Training',         'IELTS',          'IELTS General Training for immigration and work visa purposes',           12999, 10, 'lms_course_102'),
('PTE Academic Core',              'PTE',            'PTE Academic full preparation: reading, writing, speaking, listening',    9999,  10, 'lms_course_103'),
('PTE Score Booster (7-Day)',       'PTE',            'Intensive 7-day crash course for PTE score improvement',                  4999,  1,  'lms_course_104'),
('TOEFL Comprehensive Prep',       'TOEFL',          'TOEFL iBT complete preparation with strategy sessions',                  12499, 12, 'lms_course_105'),
('German A1 Intensive',            'GERMAN',         'German language from scratch: A1 level with conversational focus',       18999, 16, 'lms_course_106'),
('German A2 Intermediate',         'GERMAN',         'Advance from A1 to A2 with grammar, reading and speaking',              21999, 16, 'lms_course_107'),
('Spoken English Mastery',         'SPOKEN_ENGLISH', 'Fluency building, pronunciation, and professional communication',        7999,  8,  'lms_course_108'),
('French A1 Beginner',             'FRENCH',         'Introduction to French for travel, work, and immigration',              15999, 14, 'lms_course_109'),
('IELTS + PTE Combo Pack',         'IELTS',          'Best value combo: IELTS Academic + PTE Academic at a special price',    19999, 20, 'lms_course_110');

-- Super Admin user (password: Admin@123)
INSERT INTO users (name, email, password_hash, role) VALUES
('Super Admin', 'admin@testprep.com', '$2b$10$rQZ9uCw1sGzHvLEa2hA7a.8kDmjDtKXqvzGpRoE0FMnYQ5pSbGVWS', 'super_admin');

-- Partner Admin users (password: Partner@123)
INSERT INTO users (name, email, password_hash, role, agency_id) VALUES
('Rajan Mehta',   'admin@brightpath.in',  '$2b$10$rQZ9uCw1sGzHvLEa2hA7a.8kDmjDtKXqvzGpRoE0FMnYQ5pSbGVWS', 'partner_admin', 1),
('Sonia Kapoor',  'ops@globalvisa.com',   '$2b$10$rQZ9uCw1sGzHvLEa2hA7a.8kDmjDtKXqvzGpRoE0FMnYQ5pSbGVWS', 'partner_admin', 2),
('Arjun Desai',   'info@edustar.co',      '$2b$10$rQZ9uCw1sGzHvLEa2hA7a.8kDmjDtKXqvzGpRoE0FMnYQ5pSbGVWS', 'partner_admin', 3);

-- 25 Students (distributed across agencies, password: Student@123)
INSERT INTO users (name, email, password_hash, role, agency_id, phone, lms_user_id) VALUES
-- BrightPath students (12)
('Priya Sharma',      'priya.sharma@email.com',    '$2b$10$rQZ9uCw1sGzHvLEa2hA7a.8kDmjDtKXqvzGpRoE0FMnYQ5pSbGVWS', 'student', 1, '9876001001', 'lms_u_1001'),
('Rahul Mehta',       'rahul.mehta@email.com',     '$2b$10$rQZ9uCw1sGzHvLEa2hA7a.8kDmjDtKXqvzGpRoE0FMnYQ5pSbGVWS', 'student', 1, '9876001002', 'lms_u_1002'),
('Ananya Singh',      'ananya.singh@email.com',    '$2b$10$rQZ9uCw1sGzHvLEa2hA7a.8kDmjDtKXqvzGpRoE0FMnYQ5pSbGVWS', 'student', 1, '9876001003', 'lms_u_1003'),
('Vikram Joshi',      'vikram.joshi@email.com',    '$2b$10$rQZ9uCw1sGzHvLEa2hA7a.8kDmjDtKXqvzGpRoE0FMnYQ5pSbGVWS', 'student', 1, '9876001004', 'lms_u_1004'),
('Deepa Rao',         'deepa.rao@email.com',       '$2b$10$rQZ9uCw1sGzHvLEa2hA7a.8kDmjDtKXqvzGpRoE0FMnYQ5pSbGVWS', 'student', 1, '9876001005', 'lms_u_1005'),
('Arun Kumar',        'arun.kumar@email.com',      '$2b$10$rQZ9uCw1sGzHvLEa2hA7a.8kDmjDtKXqvzGpRoE0FMnYQ5pSbGVWS', 'student', 1, '9876001006', 'lms_u_1006'),
('Sneha Patil',       'sneha.patil@email.com',     '$2b$10$rQZ9uCw1sGzHvLEa2hA7a.8kDmjDtKXqvzGpRoE0FMnYQ5pSbGVWS', 'student', 1, '9876001007', 'lms_u_1007'),
('Manish Gupta',      'manish.gupta@email.com',    '$2b$10$rQZ9uCw1sGzHvLEa2hA7a.8kDmjDtKXqvzGpRoE0FMnYQ5pSbGVWS', 'student', 1, '9876001008', 'lms_u_1008'),
('Kavya Nair',        'kavya.nair@email.com',      '$2b$10$rQZ9uCw1sGzHvLEa2hA7a.8kDmjDtKXqvzGpRoE0FMnYQ5pSbGVWS', 'student', 1, '9876001009', 'lms_u_1009'),
('Rohan Das',         'rohan.das@email.com',       '$2b$10$rQZ9uCw1sGzHvLEa2hA7a.8kDmjDtKXqvzGpRoE0FMnYQ5pSbGVWS', 'student', 1, '9876001010', 'lms_u_1010'),
('Pooja Verma',       'pooja.verma@email.com',     '$2b$10$rQZ9uCw1sGzHvLEa2hA7a.8kDmjDtKXqvzGpRoE0FMnYQ5pSbGVWS', 'student', 1, '9876001011', 'lms_u_1011'),
('Suresh Iyer',       'suresh.iyer@email.com',     '$2b$10$rQZ9uCw1sGzHvLEa2hA7a.8kDmjDtKXqvzGpRoE0FMnYQ5pSbGVWS', 'student', 1, '9876001012', 'lms_u_1012'),
-- GlobalVisa students (8)
('Kabir Nair',        'kabir.nair@email.com',      '$2b$10$rQZ9uCw1sGzHvLEa2hA7a.8kDmjDtKXqvzGpRoE0FMnYQ5pSbGVWS', 'student', 2, '9765001001', 'lms_u_2001'),
('Meera Patel',       'meera.patel@email.com',     '$2b$10$rQZ9uCw1sGzHvLEa2hA7a.8kDmjDtKXqvzGpRoE0FMnYQ5pSbGVWS', 'student', 2, '9765001002', 'lms_u_2002'),
('Fatima Sheikh',     'fatima.sheikh@email.com',   '$2b$10$rQZ9uCw1sGzHvLEa2hA7a.8kDmjDtKXqvzGpRoE0FMnYQ5pSbGVWS', 'student', 2, '9765001003', 'lms_u_2003'),
('Rohit Kapoor',      'rohit.kapoor@email.com',    '$2b$10$rQZ9uCw1sGzHvLEa2hA7a.8kDmjDtKXqvzGpRoE0FMnYQ5pSbGVWS', 'student', 2, '9765001004', 'lms_u_2004'),
('Sana Khan',         'sana.khan@email.com',       '$2b$10$rQZ9uCw1sGzHvLEa2hA7a.8kDmjDtKXqvzGpRoE0FMnYQ5pSbGVWS', 'student', 2, '9765001005', 'lms_u_2005'),
('Nikhil Bhat',       'nikhil.bhat@email.com',     '$2b$10$rQZ9uCw1sGzHvLEa2hA7a.8kDmjDtKXqvzGpRoE0FMnYQ5pSbGVWS', 'student', 2, '9765001006', 'lms_u_2006'),
('Tanvi Shah',        'tanvi.shah@email.com',      '$2b$10$rQZ9uCw1sGzHvLEa2hA7a.8kDmjDtKXqvzGpRoE0FMnYQ5pSbGVWS', 'student', 2, '9765001007', 'lms_u_2007'),
('Aditya Menon',      'aditya.menon@email.com',    '$2b$10$rQZ9uCw1sGzHvLEa2hA7a.8kDmjDtKXqvzGpRoE0FMnYQ5pSbGVWS', 'student', 2, '9765001008', 'lms_u_2008'),
-- EduStar students (5)
('Tanvi More',        'tanvi.more@email.com',      '$2b$10$rQZ9uCw1sGzHvLEa2hA7a.8kDmjDtKXqvzGpRoE0FMnYQ5pSbGVWS', 'student', 3, '9654001001', 'lms_u_3001'),
('Arjun Bose',        'arjun.bose@email.com',      '$2b$10$rQZ9uCw1sGzHvLEa2hA7a.8kDmjDtKXqvzGpRoE0FMnYQ5pSbGVWS', 'student', 3, '9654001002', 'lms_u_3002'),
('Riya Shetty',       'riya.shetty@email.com',     '$2b$10$rQZ9uCw1sGzHvLEa2hA7a.8kDmjDtKXqvzGpRoE0FMnYQ5pSbGVWS', 'student', 3, '9654001003', 'lms_u_3003'),
('Dev Pillai',        'dev.pillai@email.com',      '$2b$10$rQZ9uCw1sGzHvLEa2hA7a.8kDmjDtKXqvzGpRoE0FMnYQ5pSbGVWS', 'student', 3, '9654001004', 'lms_u_3004'),
('Ishaan Tiwari',     'ishaan.tiwari@email.com',   '$2b$10$rQZ9uCw1sGzHvLEa2hA7a.8kDmjDtKXqvzGpRoE0FMnYQ5pSbGVWS', 'student', 3, '9654001005', 'lms_u_3005');

-- Enrollments (varied courses per agency)
-- BrightPath students - mix of IELTS, PTE, TOEFL, German
INSERT INTO enrollments (student_id, agency_id, course_id, fee_paid, payment_status, payment_date, lms_enrolled, progress_percent, status) VALUES
(5,  1, 1,  14999, 'paid',    '2024-02-10', 1, 85, 'active'),    -- Priya - IELTS Academic
(6,  1, 3,  9999,  'paid',    '2024-02-18', 1, 70, 'active'),    -- Rahul - PTE Academic
(7,  1, 1,  14999, 'paid',    '2024-03-01', 1, 45, 'active'),    -- Ananya - IELTS Academic
(8,  1, 6,  18999, 'paid',    '2024-03-10', 1, 30, 'active'),    -- Vikram - German A1
(9,  1, 5,  12499, 'paid',    '2024-03-15', 1, 60, 'active'),    -- Deepa - TOEFL
(10, 1, 8,  7999,  'paid',    '2024-03-20', 1, 90, 'completed'), -- Arun - Spoken English
(11, 1, 2,  12999, 'paid',    '2024-04-01', 1, 20, 'active'),    -- Sneha - IELTS General
(12, 1, 10, 19999, 'paid',    '2024-04-05', 1, 15, 'active'),    -- Manish - IELTS+PTE Combo
(13, 1, 3,  9999,  'pending', NULL,         0, 0,  'on_hold'),   -- Kavya - PTE (unpaid)
(14, 1, 7,  21999, 'paid',    '2024-04-10', 1, 10, 'active'),    -- Rohan - German A2
(15, 1, 4,  4999,  'paid',    '2024-04-12', 1, 100,'completed'), -- Pooja - PTE Booster
(16, 1, 9,  15999, 'paid',    '2024-04-15', 1, 5,  'active'),    -- Suresh - French A1
-- GlobalVisa students - TOEFL, IELTS, German focus
(17, 2, 5,  12499, 'paid',    '2024-03-15', 1, 75, 'active'),    -- Kabir - TOEFL
(18, 2, 6,  18999, 'pending', NULL,         0, 0,  'on_hold'),   -- Meera - German A1 (unpaid)
(19, 2, 1,  14999, 'paid',    '2024-03-20', 1, 55, 'active'),    -- Fatima - IELTS Academic
(20, 2, 3,  9999,  'paid',    '2024-04-01', 1, 40, 'active'),    -- Rohit - PTE
(21, 2, 2,  12999, 'paid',    '2024-04-05', 1, 25, 'active'),    -- Sana - IELTS General
(22, 2, 7,  21999, 'paid',    '2024-04-08', 1, 35, 'active'),    -- Nikhil - German A2
(23, 2, 5,  12499, 'paid',    '2024-04-10', 1, 50, 'active'),    -- Tanvi Shah - TOEFL
(24, 2, 10, 19999, 'paid',    '2024-04-12', 1, 20, 'active'),    -- Aditya - Combo
-- EduStar students - PTE, Spoken English, IELTS
(25, 3, 3,  9999,  'paid',    '2024-05-22', 1, 65, 'active'),    -- Tanvi More - PTE
(26, 3, 8,  7999,  'paid',    '2024-05-25', 1, 80, 'active'),    -- Arjun - Spoken English
(27, 3, 1,  14999, 'pending', NULL,         0, 0,  'on_hold'),   -- Riya - IELTS (unpaid)
(28, 3, 3,  9999,  'paid',    '2024-06-01', 1, 30, 'active'),    -- Dev - PTE
(29, 3, 8,  7999,  'paid',    '2024-06-05', 1, 45, 'active');    -- Ishaan - Spoken English

-- Coupons
INSERT INTO coupons (code, agency_id, discount_type, value, min_order, expires_at, used_count) VALUES
('BRIGHT20',  1, 'percentage', 20, 5000,  '2025-09-30', 12),
('BPATH500',  1, 'fixed',      500, 8000, '2025-06-30', 8),
('BPATH10',   1, 'percentage', 10, 0,     '2025-12-31', 3),
('GVISA15',   2, 'percentage', 15, 5000,  '2025-08-31', 5),
('GVISA1000', 2, 'fixed',      1000,10000,'2025-07-31', 2),
('STAR10',    3, 'percentage', 10, 4000,  '2025-07-31', 2),
('EDU500',    3, 'fixed',      500, 6000, '2025-10-31', 1);

-- Payout Requests
INSERT INTO payouts (agency_id, amount, eligible_students, status, requested_at, processed_at) VALUES
(1, 856200, 9,  'pending',  '2025-04-10 10:00:00', NULL),
(2, 522400, 7,  'approved', '2025-03-28 11:00:00', '2025-03-30 14:00:00'),
(1, 432000, 6,  'paid',     '2025-02-15 09:00:00', '2025-02-18 16:00:00'),
(3, 145200, 4,  'pending',  '2025-04-18 12:00:00', NULL);

-- CRM Leads
INSERT INTO leads (agency_id, name, email, phone, course_interest, status) VALUES
(1, 'Sana Mirza',      'sana.m@mail.com',     '9800001111', 'IELTS',    'new'),
(1, 'Rohit Sharma',    'rohit.s@mail.com',    '9800001112', 'PTE',      'contacted'),
(1, 'Geeta Reddy',     'geeta.r@mail.com',    '9800001113', 'TOEFL',    'demo_done'),
(1, 'Arun Das',        'arun.d@mail.com',     '9800001114', 'German A1','enrolled'),
(1, 'Poonam Agarwal',  'poonam.a@mail.com',   '9800001115', 'IELTS',    'new'),
(2, 'Fateh Singh',     'fateh.s@mail.com',    '9700001111', 'IELTS',    'new'),
(2, 'Riya Kapoor',     'riya.k@mail.com',     '9700001112', 'PTE',      'demo_done'),
(2, 'Sahil Bose',      'sahil.b@mail.com',    '9700001113', 'TOEFL',    'contacted'),
(3, 'Tanvi Joshi',     'tanvi.j@mail.com',    '9600001111', 'IELTS',    'contacted'),
(3, 'Mohan Pillai',    'mohan.p@mail.com',    '9600001112', 'Spoken English','new');

COMMIT;
