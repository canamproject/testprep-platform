const mysql = require('mysql2/promise');

async function setupDatabase() {
  // Railway provides DATABASE_URL environment variable
  const dbUrl = process.env.DATABASE_URL || process.env.MYSQL_URL;
  
  if (!dbUrl) {
    console.error('❌ No DATABASE_URL found. Make sure MySQL is connected in Railway.');
    process.exit(1);
  }

  console.log('✅ Connecting to Railway MySQL...');
  
  const pool = mysql.createPool(dbUrl);
  
  try {
    // Create tables
    console.log('Creating tables...');
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS agencies (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(100) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        city VARCHAR(100),
        brand_color VARCHAR(10) DEFAULT '#1e40af',
        logo_initials VARCHAR(5),
        commission_rate DECIMAL(5,2) DEFAULT 60.00,
        status ENUM('active','pending','suspended') DEFAULT 'active',
        lms_api_key VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('super_admin','partner_admin','student') NOT NULL,
        agency_id INT,
        phone VARCHAR(20),
        lms_user_id VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE SET NULL
      )
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS courses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        category ENUM('IELTS','PTE','TOEFL','GERMAN','FRENCH','SPOKEN_ENGLISH','OTHER') NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        duration_weeks INT DEFAULT 12,
        lms_course_id VARCHAR(100),
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await pool.query(`
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
        lms_enrolled TINYINT(1) DEFAULT 0,
        sso_token VARCHAR(512),
        progress_percent INT DEFAULT 0,
        status ENUM('active','completed','cancelled','on_hold') DEFAULT 'active',
        enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES users(id),
        FOREIGN KEY (agency_id) REFERENCES agencies(id),
        FOREIGN KEY (course_id) REFERENCES courses(id)
      )
    `);
    
    // Live classes tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS batches (
        id INT AUTO_INCREMENT PRIMARY KEY,
        agency_id INT NOT NULL,
        course_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        start_date DATE,
        end_date DATE,
        max_students INT DEFAULT 20,
        instructor_name VARCHAR(255),
        class_time TIME,
        duration_minutes INT DEFAULT 60,
        status ENUM('draft','scheduled','active','completed','cancelled') DEFAULT 'scheduled',
        created_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (agency_id) REFERENCES agencies(id),
        FOREIGN KEY (course_id) REFERENCES courses(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS live_classes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        batch_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        instructor_id INT,
        scheduled_at DATETIME NOT NULL,
        duration_minutes INT DEFAULT 60,
        class_mode ENUM('interactive','broadcast','hybrid') DEFAULT 'interactive',
        max_participants INT DEFAULT 50,
        jitsi_room_name VARCHAR(255),
        jitsi_token VARCHAR(512),
        access_type ENUM('enrolled','demo','public') DEFAULT 'enrolled',
        demo_expires_at TIMESTAMP NULL,
        recording_url VARCHAR(500),
        status ENUM('scheduled','live','completed','cancelled') DEFAULT 'scheduled',
        created_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (batch_id) REFERENCES batches(id),
        FOREIGN KEY (instructor_id) REFERENCES users(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);
    
    console.log('✅ Tables created successfully!');
    
    // Insert seed data
    console.log('Inserting seed data...');
    
    // Check if data already exists
    const [agencies] = await pool.query('SELECT COUNT(*) as count FROM agencies');
    
    if (agencies[0].count === 0) {
      await pool.query(`
        INSERT INTO agencies (name, slug, email, city, brand_color, logo_initials, commission_rate) VALUES
        ('BrightPath Academy', 'brightpath', 'admin@brightpath.in', 'Mumbai', '#1e40af', 'BP', 60.00),
        ('GlobalVisa Consultants', 'globalvisa', 'ops@globalvisa.com', 'Delhi', '#0f766e', 'GV', 65.00),
        ('EduStar Institute', 'edustar', 'info@edustar.co', 'Bangalore', '#7c3aed', 'ES', 55.00)
      `);
      
      await pool.query(`
        INSERT INTO courses (title, category, description, price, duration_weeks) VALUES
        ('IELTS Academic Masterclass', 'IELTS', 'Complete IELTS Academic preparation', 14999, 12),
        ('PTE Academic Core', 'PTE', 'PTE Academic full preparation', 9999, 10),
        ('TOEFL Comprehensive Prep', 'TOEFL', 'TOEFL iBT complete preparation', 12499, 12)
      `);
      
      // Password: admin123
      await pool.query(`
        INSERT INTO users (name, email, password_hash, role) VALUES
        ('Super Admin', 'admin@testprep.com', '$2a$10$HoBlktq2/wVkXmp6JS1iY.h57WTazzOD01f936aBoYsW10LZhAjqS', 'super_admin')
      `);
      
      // Password: partner123
      await pool.query(`
        INSERT INTO users (name, email, password_hash, role, agency_id) VALUES
        ('Rajan Mehta', 'admin@brightpath.in', '$2a$10$HoBlktq2/wVkXmp6JS1iY.h57WTazzOD01f936aBoYsW10LZhAjqS', 'partner_admin', 1),
        ('Sonia Kapoor', 'ops@globalvisa.com', '$2a$10$HoBlktq2/wVkXmp6JS1iY.h57WTazzOD01f936aBoYsW10LZhAjqS', 'partner_admin', 2)
      `);
      
      // Password: student123
      await pool.query(`
        INSERT INTO users (name, email, password_hash, role, agency_id, phone) VALUES
        ('Priya Sharma', 'priya.sharma@email.com', '$2a$10$HoBlktq2/wVkXmp6JS1iY.h57WTazzOD01f936aBoYsW10LZhAjqS', 'student', 1, '9876001001'),
        ('Kabir Nair', 'kabir.nair@email.com', '$2a$10$HoBlktq2/wVkXmp6JS1iY.h57WTazzOD01f936aBoYsW10LZhAjqS', 'student', 2, '9765001001')
      `);
      
      await pool.query(`
        INSERT INTO enrollments (student_id, agency_id, course_id, fee_paid, payment_status, payment_date, progress_percent, status) VALUES
        (5, 1, 1, 14999, 'paid', '2024-02-10', 85, 'active'),
        (6, 2, 3, 12499, 'paid', '2024-03-15', 75, 'active')
      `);
      
      console.log('✅ Seed data inserted!');
    } else {
      console.log('ℹ️ Data already exists, skipping seed.');
    }
    
    // Verify
    const [tables] = await pool.query('SHOW TABLES');
    console.log('\n📋 Tables created:');
    tables.forEach(t => console.log(`  - ${Object.values(t)[0]}`));
    
    const [userCount] = await pool.query('SELECT COUNT(*) as count FROM users');
    console.log(`\n👥 Users: ${userCount[0].count}`);
    
    console.log('\n🎉 Database setup complete!');
    console.log('\nTest credentials:');
    console.log('  Admin: admin@testprep.com / admin123');
    console.log('  Partner: admin@brightpath.in / partner123');
    console.log('  Student: priya.sharma@email.com / student123');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setupDatabase();
