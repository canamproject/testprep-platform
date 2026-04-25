const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function check() {
  const pool = mysql.createPool({host:'localhost',user:'root',password:'',database:'testprep_platform'});
  const [[user]] = await pool.query("SELECT * FROM users WHERE email='admin@testprep.com'");
  
  if (!user) {
    console.log('User not found!');
    return;
  }
  
  console.log('User:', user.email, 'Role:', user.role);
  console.log('Password hash:', user.password?.substring(0, 50));
  
  const testPasswords = ['admin123', 'Admin@123', 'password', '123456', 'test'];
  
  for (const pwd of testPasswords) {
    const isMatch = await bcrypt.compare(pwd, user.password);
    if (isMatch) {
      console.log('✓ Password is:', pwd);
      break;
    }
  }
  
  await pool.end();
}

check();
