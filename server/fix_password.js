const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function fixPasswords() {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'testprep_platform'
  });

  // Set admin password to 'admin123'
  const adminHash = await bcrypt.hash('admin123', 10);
  await pool.query('UPDATE users SET password_hash = ? WHERE email = ?', [adminHash, 'admin@testprep.com']);
  
  // Set student password to 'student123'  
  const studentHash = await bcrypt.hash('student123', 10);
  await pool.query('UPDATE users SET password_hash = ? WHERE email = ?', [studentHash, 'student@example.com']);
  
  // Set partner password to 'partner123'
  const partnerHash = await bcrypt.hash('partner123', 10);
  await pool.query('UPDATE users SET password_hash = ? WHERE email IN (?, ?, ?)', 
    [partnerHash, 'partner@brightpath.com', 'partner@globalvisa.com', 'partner@edustar.com']);
  
  console.log('✓ Passwords updated!');
  console.log('  admin@testprep.com: admin123');
  console.log('  student@example.com: student123');
  console.log('  partner@brightpath.com: partner123');
  console.log('  partner@globalvisa.com: partner123');
  console.log('  partner@edustar.com: partner123');
  
  await pool.end();
}

fixPasswords().catch(console.error);
