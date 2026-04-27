// ============================================================
// TestPrepGPT White-Label Platform - Express API Server
// ============================================================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');

const app = express();
app.use(cors({ 
  origin: [
    'http://localhost:5173', 
    'http://localhost:5174', 
    'http://localhost:5175',
    'https://client-af1k9zq7z-canamprojects-projects.vercel.app',
    'https://client-5de2r4tul-canamprojects-projects.vercel.app',
    /\.vercel\.app$/
  ], 
  credentials: true 
}));
app.use(express.json());

// ─── DB Pool ────────────────────────────────────────────────
// Support Railway DATABASE_URL or individual env vars
let pool = null;
let dbConnected = false;

function getPool() {
  if (pool) return pool;
  
  let dbConfig;
  if (process.env.DATABASE_URL || process.env.MYSQL_URL) {
    dbConfig = process.env.DATABASE_URL || process.env.MYSQL_URL;
  } else {
    dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'testprep_platform',
      waitForConnections: true,
      connectionLimit: 10,
    };
  }
  pool = mysql.createPool(dbConfig);
  return pool;
}

const JWT_SECRET = process.env.JWT_SECRET || 'testprep_secret';

// ─── Auth Middleware ─────────────────────────────────────────
function authMiddleware(roles = []) {
  return (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      if (roles.length && !roles.includes(decoded.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      next();
    } catch {
      res.status(401).json({ error: 'Invalid token' });
    }
  };
}

// ─── HEALTH ──────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    const p = getPool();
    if (!p) throw new Error('No DB config');
    await p.query('SELECT 1');
    dbConnected = true;
    res.json({ status: 'ok', db: 'connected' });
  } catch (e) {
    res.json({ status: 'ok', db: 'disconnected', message: 'DB not configured yet' });
  }
});

// ─── AUTH ─────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing fields' });
  try {
    const [rows] = await getPool().query(
      'SELECT u.*, a.name as agency_name, a.slug as agency_slug, a.brand_color, a.logo_initials, a.commission_rate FROM users u LEFT JOIN agencies a ON u.agency_id = a.id WHERE u.email = ?',
      [email]
    );
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });
    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, agency_id: user.agency_id },
      JWT_SECRET, { expiresIn: '24h' }
    );
    res.json({
      token,
      user: {
        id: user.id, name: user.name, email: user.email, role: user.role,
        agency_id: user.agency_id, agency_name: user.agency_name,
        agency_slug: user.agency_slug, brand_color: user.brand_color,
        logo_initials: user.logo_initials
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/auth/me', authMiddleware(), async (req, res) => {
  try {
    const [rows] = await getPool().query(
      'SELECT u.id, u.name, u.email, u.role, u.agency_id, u.phone, u.lms_user_id, a.name as agency_name, a.slug, a.brand_color, a.logo_initials, a.commission_rate, a.email as agency_email, a.phone as agency_phone, a.city FROM users u LEFT JOIN agencies a ON u.agency_id = a.id WHERE u.id = ?',
      [req.user.id]
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── ADMIN: AGENCIES ──────────────────────────────────────────
app.get('/api/admin/agencies', authMiddleware(['super_admin']), async (req, res) => {
  const [rows] = await getPool().query(`
    SELECT a.*, 
      COUNT(DISTINCT u.id) as student_count,
      COALESCE(SUM(e.fee_paid), 0) as total_revenue
    FROM agencies a
    LEFT JOIN users u ON u.agency_id = a.id AND u.role = 'student'
    LEFT JOIN enrollments e ON e.agency_id = a.id AND e.payment_status = 'paid'
    GROUP BY a.id ORDER BY a.created_at DESC
  `);
  res.json(rows);
});

app.post('/api/admin/agencies', authMiddleware(['super_admin']), async (req, res) => {
  const { name, slug, email, phone, city, brand_color, commission_rate, logo_initials } = req.body;
  try {
    const [result] = await getPool().query(
      'INSERT INTO agencies (name, slug, email, phone, city, brand_color, commission_rate, logo_initials) VALUES (?,?,?,?,?,?,?,?)',
      [name, slug, email, phone, city, brand_color || '#1e40af', commission_rate || 60, logo_initials || name.slice(0,2).toUpperCase()]
    );
    res.json({ id: result.insertId, message: 'Agency created' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.put('/api/admin/agencies/:id', authMiddleware(['super_admin']), async (req, res) => {
  const { name, email, phone, city, brand_color, commission_rate, status } = req.body;
  await getPool().query(
    'UPDATE agencies SET name=?, email=?, phone=?, city=?, brand_color=?, commission_rate=?, status=? WHERE id=?',
    [name, email, phone, city, brand_color, commission_rate, status, req.params.id]
  );
  res.json({ message: 'Updated' });
});

// ─── ADMIN: OVERVIEW STATS ────────────────────────────────────
app.get('/api/admin/stats', authMiddleware(['super_admin']), async (req, res) => {
  const [[revenue]] = await getPool().query('SELECT COALESCE(SUM(fee_paid),0) as total FROM enrollments WHERE payment_status="paid"');
  const [[students]] = await getPool().query('SELECT COUNT(*) as count FROM users WHERE role="student"');
  const [[agencies]] = await getPool().query('SELECT COUNT(*) as count FROM agencies WHERE status="active"');
  const [[pending]] = await getPool().query('SELECT COALESCE(SUM(amount),0) as total, COUNT(*) as count FROM payouts WHERE status="pending"');
  res.json({ total_revenue: revenue.total, total_students: students.count, active_agencies: agencies.count, pending_payouts: pending.total, pending_payout_count: pending.count });
});

// ─── ADMIN: ALL STUDENTS ──────────────────────────────────────
app.get('/api/admin/students', authMiddleware(['super_admin']), async (req, res) => {
  const [rows] = await getPool().query(`
    SELECT u.id, u.name, u.email, u.phone, u.lms_user_id, u.created_at,
      a.name as agency_name, a.brand_color, a.slug as agency_slug,
      COUNT(e.id) as enrollment_count,
      COALESCE(SUM(CASE WHEN e.payment_status='paid' THEN e.fee_paid ELSE 0 END),0) as total_paid
    FROM users u
    JOIN agencies a ON u.agency_id = a.id
    LEFT JOIN enrollments e ON e.student_id = u.id
    WHERE u.role = 'student'
    GROUP BY u.id ORDER BY u.created_at DESC
  `);
  res.json(rows);
});

// ─── ADMIN: PAYOUTS ───────────────────────────────────────────
app.get('/api/admin/payouts', authMiddleware(['super_admin']), async (req, res) => {
  const [rows] = await getPool().query(`
    SELECT p.*, a.name as agency_name, a.brand_color, a.slug 
    FROM payouts p JOIN agencies a ON p.agency_id = a.id ORDER BY p.requested_at DESC
  `);
  res.json(rows);
});

app.put('/api/admin/payouts/:id', authMiddleware(['super_admin']), async (req, res) => {
  const { status, admin_note } = req.body;
  await getPool().query(
    'UPDATE payouts SET status=?, admin_note=?, processed_at=NOW() WHERE id=?',
    [status, admin_note, req.params.id]
  );
  res.json({ message: 'Payout updated' });
});

// ─── ADMIN: COUPONS ───────────────────────────────────────────
app.get('/api/admin/coupons', authMiddleware(['super_admin']), async (req, res) => {
  const [rows] = await getPool().query(`
    SELECT c.*, a.name as agency_name, a.brand_color FROM coupons c JOIN agencies a ON c.agency_id = a.id ORDER BY c.created_at DESC
  `);
  res.json(rows);
});

// ─── ADMIN: ALL ENROLLMENTS ───────────────────────────────────
app.get('/api/admin/enrollments', authMiddleware(['super_admin']), async (req, res) => {
  const [rows] = await getPool().query(`
    SELECT e.*, u.name as student_name, u.email as student_email,
      c.title as course_title, c.category,
      a.name as agency_name, a.brand_color
    FROM enrollments e
    JOIN users u ON e.student_id = u.id
    JOIN courses c ON e.course_id = c.id
    JOIN agencies a ON e.agency_id = a.id
    ORDER BY e.enrolled_at DESC
  `);
  res.json(rows);
});

// ─── COURSES ──────────────────────────────────────────────────
app.get('/api/courses', async (req, res) => {
  const [rows] = await getPool().query('SELECT id, title, category, description, price, duration_weeks FROM courses WHERE is_active=1 ORDER BY category, title');
  res.json(rows);
});

app.post('/api/admin/courses', authMiddleware(['super_admin']), async (req, res) => {
  const { title, category, description, price, duration_weeks } = req.body;
  const [result] = await getPool().query(
    'INSERT INTO courses (title, category, description, price, duration_weeks) VALUES (?,?,?,?,?)',
    [title, category, description, price, duration_weeks || 12]
  );
  res.json({ id: result.insertId });
});

// ─── PARTNER: DASHBOARD ───────────────────────────────────────
app.get('/api/partner/stats', authMiddleware(['partner_admin']), async (req, res) => {
  const agencyId = req.user.agency_id;
  const [[rev]] = await getPool().query('SELECT COALESCE(SUM(fee_paid),0) as total FROM enrollments WHERE agency_id=? AND payment_status="paid"', [agencyId]);
  const [[students]] = await getPool().query('SELECT COUNT(*) as count FROM users WHERE agency_id=? AND role="student"', [agencyId]);
  const [[paid]] = await getPool().query('SELECT COUNT(*) as count FROM enrollments WHERE agency_id=? AND payment_status="paid"', [agencyId]);
  const [[pending]] = await getPool().query('SELECT COALESCE(SUM(amount),0) as total FROM payouts WHERE agency_id=? AND status="pending"', [agencyId]);
  const [agency] = await getPool().query('SELECT commission_rate FROM agencies WHERE id=?', [agencyId]);
  const commRate = agency[0]?.commission_rate || 60;
  res.json({
    total_revenue: rev.total,
    partner_earnings: Math.round(rev.total * commRate / 100),
    platform_cut: Math.round(rev.total * (100 - commRate) / 100),
    total_students: students.count,
    paid_students: paid.count,
    pending_payout: pending.total,
    commission_rate: commRate
  });
});

app.get('/api/partner/students', authMiddleware(['partner_admin']), async (req, res) => {
  const [rows] = await getPool().query(`
    SELECT u.id, u.name, u.email, u.phone, u.lms_user_id, u.created_at,
      COUNT(e.id) as enrollment_count,
      COALESCE(SUM(CASE WHEN e.payment_status='paid' THEN e.fee_paid ELSE 0 END),0) as total_paid,
      MAX(e.payment_status) as latest_payment_status
    FROM users u
    LEFT JOIN enrollments e ON e.student_id = u.id
    WHERE u.agency_id = ? AND u.role = 'student'
    GROUP BY u.id ORDER BY u.created_at DESC
  `, [req.user.agency_id]);
  res.json(rows);
});

app.post('/api/partner/students', authMiddleware(['partner_admin']), async (req, res) => {
  const { name, email, phone } = req.body;
  const agencyId = req.user.agency_id;
  const passwordHash = await bcrypt.hash('Student@123', 10);
  const lmsUserId = `lms_u_${Date.now()}`;
  try {
    const [result] = await getPool().query(
      'INSERT INTO users (name, email, password_hash, role, agency_id, phone, lms_user_id) VALUES (?,?,?,?,?,?,?)',
      [name, email, passwordHash, 'student', agencyId, phone, lmsUserId]
    );
    res.json({ id: result.insertId, message: 'Student registered', default_password: 'Student@123' });
  } catch (e) {
    res.status(400).json({ error: e.code === 'ER_DUP_ENTRY' ? 'Email already exists' : e.message });
  }
});

app.get('/api/partner/enrollments', authMiddleware(['partner_admin']), async (req, res) => {
  const [rows] = await getPool().query(`
    SELECT e.*, u.name as student_name, u.email as student_email,
      c.title as course_title, c.category, c.price as course_price
    FROM enrollments e
    JOIN users u ON e.student_id = u.id
    JOIN courses c ON e.course_id = c.id
    WHERE e.agency_id = ?
    ORDER BY e.enrolled_at DESC
  `, [req.user.agency_id]);
  res.json(rows);
});

app.post('/api/partner/enrollments', authMiddleware(['partner_admin']), async (req, res) => {
  const { student_id, course_id, fee_paid, coupon_code } = req.body;
  const agencyId = req.user.agency_id;
  let discount = 0;
  if (coupon_code) {
    const [coup] = await getPool().query('SELECT * FROM coupons WHERE code=? AND agency_id=? AND is_active=1', [coupon_code, agencyId]);
    if (coup.length) {
      const c = coup[0];
      discount = c.discount_type === 'percentage' ? Math.round(fee_paid * c.value / 100) : c.value;
      await getPool().query('UPDATE coupons SET used_count=used_count+1 WHERE id=?', [c.id]);
    }
  }
  const [result] = await getPool().query(
    'INSERT INTO enrollments (student_id, agency_id, course_id, fee_paid, coupon_code, discount_amount, lms_enrolled) VALUES (?,?,?,?,?,?,1)',
    [student_id, agencyId, course_id, fee_paid - discount, coupon_code || null, discount]
  );
  res.json({ id: result.insertId, discount_applied: discount });
});

app.put('/api/partner/enrollments/:id/payment', authMiddleware(['partner_admin']), async (req, res) => {
  await getPool().query(
    "UPDATE enrollments SET payment_status='paid', payment_date=NOW() WHERE id=? AND agency_id=?",
    [req.params.id, req.user.agency_id]
  );
  res.json({ message: 'Payment marked as paid' });
});

// ─── PARTNER: PAYOUTS ─────────────────────────────────────────
app.get('/api/partner/payouts', authMiddleware(['partner_admin']), async (req, res) => {
  const [rows] = await getPool().query('SELECT * FROM payouts WHERE agency_id=? ORDER BY requested_at DESC', [req.user.agency_id]);
  res.json(rows);
});

app.post('/api/partner/payouts/claim', authMiddleware(['partner_admin']), async (req, res) => {
  const agencyId = req.user.agency_id;
  const [[rev]] = await getPool().query('SELECT COALESCE(SUM(fee_paid),0) as total, COUNT(*) as count FROM enrollments WHERE agency_id=? AND payment_status="paid"', [agencyId]);
  const [agency] = await getPool().query('SELECT commission_rate FROM agencies WHERE id=?', [agencyId]);
  const commRate = agency[0]?.commission_rate || 60;
  const claimable = Math.round(rev.total * commRate / 100);
  if (claimable <= 0) return res.status(400).json({ error: 'No claimable amount' });
  const [result] = await getPool().query(
    'INSERT INTO payouts (agency_id, amount, eligible_students, status) VALUES (?,?,?,?)',
    [agencyId, claimable, rev.count, 'pending']
  );
  res.json({ id: result.insertId, amount: claimable, message: 'Claim submitted' });
});

// ─── PARTNER: COUPONS ─────────────────────────────────────────
app.get('/api/partner/coupons', authMiddleware(['partner_admin']), async (req, res) => {
  const [rows] = await getPool().query('SELECT * FROM coupons WHERE agency_id=? ORDER BY created_at DESC', [req.user.agency_id]);
  res.json(rows);
});

app.post('/api/partner/coupons', authMiddleware(['partner_admin']), async (req, res) => {
  const { code, discount_type, value, min_order, max_uses, expires_at } = req.body;
  try {
    const [result] = await getPool().query(
      'INSERT INTO coupons (code, agency_id, discount_type, value, min_order, max_uses, expires_at) VALUES (?,?,?,?,?,?,?)',
      [code.toUpperCase(), req.user.agency_id, discount_type, value, min_order || 0, max_uses || 100, expires_at]
    );
    res.json({ id: result.insertId });
  } catch (e) {
    res.status(400).json({ error: 'Coupon code already exists' });
  }
});

// ─── PARTNER: CRM LEADS ───────────────────────────────────────
app.get('/api/partner/leads', authMiddleware(['partner_admin']), async (req, res) => {
  const [rows] = await getPool().query('SELECT * FROM leads WHERE agency_id=? ORDER BY updated_at DESC', [req.user.agency_id]);
  res.json(rows);
});

app.post('/api/partner/leads', authMiddleware(['partner_admin']), async (req, res) => {
  const { name, email, phone, course_interest, notes } = req.body;
  const [result] = await getPool().query(
    'INSERT INTO leads (agency_id, name, email, phone, course_interest, notes) VALUES (?,?,?,?,?,?)',
    [req.user.agency_id, name, email, phone, course_interest, notes]
  );
  res.json({ id: result.insertId });
});

app.put('/api/partner/leads/:id', authMiddleware(['partner_admin']), async (req, res) => {
  const { status, notes } = req.body;
  await getPool().query('UPDATE leads SET status=?, notes=? WHERE id=? AND agency_id=?', [status, notes, req.params.id, req.user.agency_id]);
  res.json({ message: 'Lead updated' });
});

// ─── PARTNER: EARNINGS ────────────────────────────────────────
app.get('/api/partner/earnings', authMiddleware(['partner_admin']), async (req, res) => {
  const [rows] = await getPool().query(`
    SELECT e.id, e.fee_paid, e.payment_status, e.payment_date, e.enrolled_at,
      u.name as student_name,
      c.title as course_title, c.category,
      ROUND(e.fee_paid * a.commission_rate / 100) as partner_earning,
      ROUND(e.fee_paid * (100 - a.commission_rate) / 100) as platform_cut
    FROM enrollments e
    JOIN users u ON e.student_id = u.id
    JOIN courses c ON e.course_id = c.id
    JOIN agencies a ON e.agency_id = a.id
    WHERE e.agency_id = ? AND e.payment_status = 'paid'
    ORDER BY e.payment_date DESC
  `, [req.user.agency_id]);
  res.json(rows);
});

// ─── STUDENT: DASHBOARD ───────────────────────────────────────
app.get('/api/student/dashboard', authMiddleware(['student']), async (req, res) => {
  const [enrollments] = await getPool().query(`
    SELECT e.id, e.fee_paid, e.payment_status, e.enrolled_at, e.progress_percent, e.status,
      c.title as course_title, c.category, c.duration_weeks,
      a.name as agency_name, a.brand_color, a.logo_initials, a.email as agency_email
    FROM enrollments e
    JOIN courses c ON e.course_id = c.id
    JOIN agencies a ON e.agency_id = a.id
    WHERE e.student_id = ?
    ORDER BY e.enrolled_at DESC
  `, [req.user.id]);
  res.json({ enrollments });
});

// ─── STUDENT: SSO TOKEN (LMS Access) ─────────────────────────
app.post('/api/student/sso/:enrollmentId', authMiddleware(['student']), async (req, res) => {
  const [[enrollment]] = await getPool().query(
    'SELECT e.*, u.lms_user_id, c.lms_course_id FROM enrollments e JOIN users u ON e.student_id = u.id JOIN courses c ON e.course_id = c.id WHERE e.id=? AND e.student_id=?',
    [req.params.enrollmentId, req.user.id]
  );
  if (!enrollment) return res.status(404).json({ error: 'Enrollment not found' });
  if (enrollment.payment_status !== 'paid') return res.status(403).json({ error: 'Payment required' });
  // Generate SSO token (would be sent to actual LMS API)
  const ssoToken = jwt.sign(
    { lms_user_id: enrollment.lms_user_id, lms_course_id: enrollment.lms_course_id, student_id: req.user.id },
    process.env.LMS_SSO_SECRET || 'lms_secret',
    { expiresIn: '1h' }
  );
  // Update token in DB
  await getPool().query('UPDATE enrollments SET sso_token=? WHERE id=?', [ssoToken, enrollment.id]);
  // In production: POST to LMS API with this token, get redirect URL
  // LMS URL is NEVER exposed to frontend — handled server-side only
  res.json({
    message: 'SSO token generated',
    redirect_url: `/learning/${enrollment.id}`, // internal route, not LMS URL
    token: ssoToken
  });
});

// ─── TENANT IDENTIFICATION ────────────────────────────────────
app.get('/api/tenant/:slug', async (req, res) => {
  const [rows] = await getPool().query(
    'SELECT id, name, slug, brand_color, logo_initials, email, phone, city, status FROM agencies WHERE slug=? AND status="active"',
    [req.params.slug]
  );
  if (!rows.length) return res.status(404).json({ error: 'Tenant not found' });
  res.json(rows[0]);
});

// ═══════════════════════════════════════════════════════════════
// LIVE CLASSES & BATCH MANAGEMENT MODULE
// ═══════════════════════════════════════════════════════════════

// ─── BATCHES: ADMIN ───────────────────────────────────────────
app.get('/api/admin/batches', authMiddleware(['super_admin']), async (req, res) => {
  const [rows] = await getPool().query(`
    SELECT b.*, a.name as agency_name, c.title as course_title,
      u.name as trainer_name,
      COUNT(be.id) as enrolled_students
    FROM batches b
    JOIN agencies a ON b.agency_id = a.id
    JOIN courses c ON b.course_id = c.id
    LEFT JOIN users u ON b.trainer_id = u.id
    LEFT JOIN batch_enrollments be ON b.id = be.batch_id AND be.status = 'active'
    GROUP BY b.id
    ORDER BY b.created_at DESC
  `);
  res.json(rows);
});

app.post('/api/admin/batches', authMiddleware(['super_admin']), async (req, res) => {
  const {
    agency_id, course_id, name, description, start_date, end_date,
    schedule_days, class_time, duration_minutes, timezone,
    trainer_id, trainer_name, max_students, jitsi_room_prefix
  } = req.body;
  
  try {
    const meetingId = `${jitsi_room_prefix || 'batch'}-${Date.now()}`;
    const [result] = await getPool().query(
      `INSERT INTO batches (agency_id, course_id, name, description, start_date, end_date,
        schedule_days, class_time, duration_minutes, timezone, trainer_id, trainer_name,
        max_students, jitsi_room_prefix, jitsi_meeting_id, created_by, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [agency_id, course_id, name, description, start_date, end_date,
       schedule_days || 'Mon,Tue,Wed,Thu,Fri', class_time, duration_minutes || 60,
       timezone || 'Asia/Kolkata', trainer_id, trainer_name, max_students || 20,
       jitsi_room_prefix, meetingId, req.user.id, 'active']
    );
    res.json({ id: result.insertId, message: 'Batch created', jitsi_meeting_id: meetingId });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.put('/api/admin/batches/:id', authMiddleware(['super_admin']), async (req, res) => {
  const {
    name, description, start_date, end_date, schedule_days, class_time,
    duration_minutes, trainer_id, trainer_name, max_students, status
  } = req.body;
  
  try {
    await getPool().query(
      `UPDATE batches SET name=?, description=?, start_date=?, end_date=?,
       schedule_days=?, class_time=?, duration_minutes=?, trainer_id=?,
       trainer_name=?, max_students=?, status=?, updated_at=NOW()
       WHERE id=?`,
      [name, description, start_date, end_date, schedule_days, class_time,
       duration_minutes, trainer_id, trainer_name, max_students, status, req.params.id]
    );
    res.json({ message: 'Batch updated' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ─── BATCHES: PARTNER ─────────────────────────────────────────
app.get('/api/partner/batches', authMiddleware(['partner_admin']), async (req, res) => {
  const [rows] = await getPool().query(`
    SELECT b.*, c.title as course_title,
      u.name as trainer_name,
      COUNT(be.id) as enrolled_students
    FROM batches b
    JOIN courses c ON b.course_id = c.id
    LEFT JOIN users u ON b.trainer_id = u.id
    LEFT JOIN batch_enrollments be ON b.id = be.batch_id AND be.status = 'active'
    WHERE b.agency_id = ?
    GROUP BY b.id
    ORDER BY b.created_at DESC
  `, [req.user.agency_id]);
  res.json(rows);
});

app.post('/api/partner/batches', authMiddleware(['partner_admin']), async (req, res) => {
  const {
    course_id, name, description, start_date, end_date,
    schedule_days, class_time, duration_minutes, trainer_id, trainer_name, max_students
  } = req.body;
  
  try {
    const agencyId = req.user.agency_id;
    const prefix = req.user.agency_slug || 'batch';
    const meetingId = `${prefix}-${Date.now()}`;
    
    const [result] = await getPool().query(
      `INSERT INTO batches (agency_id, course_id, name, description, start_date, end_date,
        schedule_days, class_time, duration_minutes, trainer_id, trainer_name,
        max_students, jitsi_room_prefix, jitsi_meeting_id, created_by, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [agencyId, course_id, name, description, start_date, end_date,
       schedule_days || 'Mon,Tue,Wed,Thu,Fri', class_time, duration_minutes || 60,
       trainer_id, trainer_name, max_students || 20,
       prefix, meetingId, req.user.id, 'active']
    );
    res.json({ id: result.insertId, message: 'Batch created', jitsi_meeting_id: meetingId });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ─── BATCH ENROLLMENTS ────────────────────────────────────────
app.get('/api/batches/:id/students', authMiddleware(), async (req, res) => {
  const [rows] = await getPool().query(`
    SELECT be.*, u.name, u.email, u.phone, e.payment_status
    FROM batch_enrollments be
    JOIN users u ON be.student_id = u.id
    LEFT JOIN enrollments e ON be.enrollment_id = e.id
    WHERE be.batch_id = ?
    ORDER BY be.joined_at DESC
  `, [req.params.id]);
  res.json(rows);
});

app.post('/api/batches/:id/enroll', authMiddleware(['partner_admin', 'super_admin']), async (req, res) => {
  const { student_id, enrollment_id, access_type } = req.body;
  const batchId = req.params.id;
  
  try {
    // Verify student belongs to partner's agency
    if (req.user.role === 'partner_admin') {
      const [[batch]] = await getPool().query('SELECT agency_id FROM batches WHERE id=?', [batchId]);
      if (!batch || batch.agency_id !== req.user.agency_id) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }
    
    const [result] = await getPool().query(
      `INSERT INTO batch_enrollments (batch_id, student_id, enrollment_id, access_type, status)
       VALUES (?,?,?,?,?)`,
      [batchId, student_id, enrollment_id, access_type || 'full', 'active']
    );
    res.json({ id: result.insertId, message: 'Student enrolled to batch' });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Student already enrolled in this batch' });
    }
    res.status(500).json({ error: e.message });
  }
});

// ─── LIVE CLASSES: ADMIN & PARTNER ────────────────────────────
app.get('/api/live-classes', authMiddleware(), async (req, res) => {
  const agencyId = req.user.agency_id;
  const isAdmin = req.user.role === 'super_admin';
  
  const query = isAdmin
    ? `SELECT lc.*, b.name as batch_name, c.title as course_title,
        a.name as agency_name
       FROM live_classes lc
       JOIN batches b ON lc.batch_id = b.id
       JOIN courses c ON b.course_id = c.id
       JOIN agencies a ON lc.agency_id = a.id
       ORDER BY lc.scheduled_at DESC`
    : `SELECT lc.*, b.name as batch_name, c.title as course_title
       FROM live_classes lc
       JOIN batches b ON lc.batch_id = b.id
       JOIN courses c ON b.course_id = c.id
       WHERE lc.agency_id = ?
       ORDER BY lc.scheduled_at DESC`;
  
  const [rows] = await getPool().query(query, isAdmin ? [] : [agencyId]);
  res.json(rows);
});

app.get('/api/live-classes/upcoming', authMiddleware(), async (req, res) => {
  const agencyId = req.user.agency_id;
  const isAdmin = req.user.role === 'super_admin';
  const studentId = req.user.role === 'student' ? req.user.id : null;
  
  let query, params;
  
  if (studentId) {
    // Student view - only their enrolled batches
    query = `SELECT lc.*, b.name as batch_name, c.title as course_title,
        be.access_type, be.demo_expires_at
       FROM live_classes lc
       JOIN batches b ON lc.batch_id = b.id
       JOIN courses c ON b.course_id = c.id
       JOIN batch_enrollments be ON b.id = be.batch_id
       WHERE be.student_id = ? AND lc.scheduled_at >= NOW()
        AND lc.status IN ('scheduled','live')
        AND (be.access_type != 'demo' OR be.demo_expires_at > NOW())
       ORDER BY lc.scheduled_at ASC
       LIMIT 10`;
    params = [studentId];
  } else if (isAdmin) {
    query = `SELECT lc.*, b.name as batch_name, c.title as course_title,
        a.name as agency_name
       FROM live_classes lc
       JOIN batches b ON lc.batch_id = b.id
       JOIN courses c ON b.course_id = c.id
       JOIN agencies a ON lc.agency_id = a.id
       WHERE lc.scheduled_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)
       ORDER BY lc.scheduled_at ASC
       LIMIT 20`;
    params = [];
  } else {
    query = `SELECT lc.*, b.name as batch_name, c.title as course_title
       FROM live_classes lc
       JOIN batches b ON lc.batch_id = b.id
       JOIN courses c ON b.course_id = c.id
       WHERE lc.agency_id = ? AND lc.scheduled_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)
       ORDER BY lc.scheduled_at ASC
       LIMIT 20`;
    params = [agencyId];
  }
  
  const [rows] = await getPool().query(query, params);
  res.json(rows);
});

app.post('/api/live-classes', authMiddleware(['partner_admin', 'super_admin']), async (req, res) => {
  const {
    batch_id, title, description, lesson_id, scheduled_at,
    duration_minutes, class_mode, auto_record
  } = req.body;
  
  try {
    // Get batch details for Jitsi room name
    const [[batch]] = await getPool().query(
      'SELECT b.*, a.slug as agency_slug FROM batches b JOIN agencies a ON b.agency_id = a.id WHERE b.id=?',
      [batch_id]
    );
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    
    // Verify access for partner
    if (req.user.role === 'partner_admin' && batch.agency_id !== req.user.agency_id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Generate unique Jitsi room name
    const roomName = `${batch.jitsi_room_prefix || batch.agency_slug}-class-${Date.now()}`;
    const meetingUrl = `https://meet.jit.si/${roomName}`;
    
    const [result] = await getPool().query(
      `INSERT INTO live_classes (batch_id, agency_id, title, description, lesson_id,
        scheduled_at, duration_minutes, jitsi_room_name, jitsi_meeting_url,
        class_mode, auto_record, created_by, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [batch_id, batch.agency_id, title, description, lesson_id,
       scheduled_at, duration_minutes || 60, roomName, meetingUrl,
       class_mode || 'interactive', auto_record || 0, req.user.id, 'scheduled']
    );
    
    res.json({ 
      id: result.insertId, 
      message: 'Live class scheduled',
      jitsi_room_name: roomName,
      jitsi_meeting_url: meetingUrl
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.put('/api/live-classes/:id', authMiddleware(['partner_admin', 'super_admin']), async (req, res) => {
  const { title, description, scheduled_at, duration_minutes, class_mode, status } = req.body;
  
  try {
    // Verify access
    if (req.user.role === 'partner_admin') {
      const [[lc]] = await getPool().query('SELECT agency_id FROM live_classes WHERE id=?', [req.params.id]);
      if (!lc || lc.agency_id !== req.user.agency_id) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }
    
    await getPool().query(
      `UPDATE live_classes SET title=?, description=?, scheduled_at=?,
       duration_minutes=?, class_mode=?, status=?, updated_at=NOW()
       WHERE id=?`,
      [title, description, scheduled_at, duration_minutes, class_mode, status, req.params.id]
    );
    res.json({ message: 'Live class updated' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ─── LIVE CLASS JOIN & TOKEN ──────────────────────────────────
app.get('/api/live-classes/:id/join', authMiddleware(), async (req, res) => {
  const classId = req.params.id;
  const userId = req.user.id;
  const userRole = req.user.role;
  
  try {
    // Get class details
    const [[liveClass]] = await getPool().query(`
      SELECT lc.*, b.agency_id, b.name as batch_name
      FROM live_classes lc
      JOIN batches b ON lc.batch_id = b.id
      WHERE lc.id = ?
    `, [classId]);
    
    if (!liveClass) return res.status(404).json({ error: 'Live class not found' });
    
    // Check permissions
    let isModerator = false;
    let canJoin = false;
    
    if (userRole === 'super_admin') {
      canJoin = true;
      isModerator = true;
    } else if (userRole === 'partner_admin') {
      canJoin = liveClass.agency_id === req.user.agency_id;
      isModerator = true;
    } else if (userRole === 'student') {
      // Check if enrolled in batch
      const [[enrollment]] = await getPool().query(`
        SELECT be.* FROM batch_enrollments be
        WHERE be.batch_id = ? AND be.student_id = ? AND be.status = 'active'
        AND (be.access_type != 'demo' OR be.demo_expires_at > NOW())
      `, [liveClass.batch_id, userId]);
      canJoin = !!enrollment;
    }
    
    if (!canJoin) {
      return res.status(403).json({ error: 'Not enrolled in this batch' });
    }
    
    // Record attendance entry
    await getPool().query(`
      INSERT INTO class_attendance (live_class_id, student_id, batch_id, joined_at, attendance_status)
      VALUES (?, ?, ?, NOW(), 'present')
      ON DUPLICATE KEY UPDATE joined_at = NOW(), attendance_status = 'present'
    `, [classId, userId, liveClass.batch_id]);
    
    // Generate Jitsi token/config
    const meetingUrl = isModerator && liveClass.jitsi_moderator_url
      ? liveClass.jitsi_moderator_url
      : liveClass.jitsi_meeting_url;
    
    res.json({
      class_id: classId,
      title: liveClass.title,
      jitsi_room_name: liveClass.jitsi_room_name,
      jitsi_meeting_url: meetingUrl,
      is_moderator: isModerator,
      class_mode: liveClass.class_mode,
      allow_chat: liveClass.allow_chat,
      allow_video: isModerator ? true : liveClass.allow_student_video,
      allow_audio: isModerator ? true : liveClass.allow_student_audio
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── ATTENDANCE & PROGRESS ────────────────────────────────────
app.post('/api/live-classes/:id/attendance', authMiddleware(['student']), async (req, res) => {
  const { duration_seconds, time_percent } = req.body;
  const classId = req.params.id;
  const studentId = req.user.id;
  
  try {
    await getPool().query(`
      UPDATE class_attendance 
      SET duration_seconds = ?, time_in_class_percent = ?, updated_at = NOW()
      WHERE live_class_id = ? AND student_id = ?
    `, [duration_seconds, time_percent, classId, studentId]);
    
    res.json({ message: 'Attendance updated' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/live-classes/:id/leave', authMiddleware(), async (req, res) => {
  const classId = req.params.id;
  const userId = req.user.id;
  
  try {
    await getPool().query(`
      UPDATE class_attendance 
      SET left_at = NOW(), updated_at = NOW()
      WHERE live_class_id = ? AND student_id = ?
    `, [classId, userId]);
    
    res.json({ message: 'Left class' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── DEMO ACCESS ──────────────────────────────────────────────
app.post('/api/demo/request', async (req, res) => {
  const { agency_id, name, email, phone, course_id, preferred_demo_date } = req.body;
  
  try {
    const [result] = await getPool().query(
      `INSERT INTO demo_access_requests (agency_id, name, email, phone, course_id, preferred_demo_date, status, source)
       VALUES (?,?,?,?,?,?,?,?)`,
      [agency_id, name, email, phone, course_id, preferred_demo_date, 'pending', 'website']
    );
    res.json({ id: result.insertId, message: 'Demo request submitted' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/demo/requests', authMiddleware(['partner_admin', 'super_admin']), async (req, res) => {
  const agencyId = req.user.agency_id;
  const isAdmin = req.user.role === 'super_admin';
  
  const query = isAdmin
    ? `SELECT d.*, c.title as course_title, b.name as batch_name
       FROM demo_access_requests d
       LEFT JOIN courses c ON d.course_id = c.id
       LEFT JOIN batches b ON d.demo_batch_id = b.id
       ORDER BY d.created_at DESC`
    : `SELECT d.*, c.title as course_title, b.name as batch_name
       FROM demo_access_requests d
       LEFT JOIN courses c ON d.course_id = c.id
       LEFT JOIN batches b ON d.demo_batch_id = b.id
       WHERE d.agency_id = ?
       ORDER BY d.created_at DESC`;
  
  const [rows] = await getPool().query(query, isAdmin ? [] : [agencyId]);
  res.json(rows);
});

app.put('/api/demo/requests/:id/approve', authMiddleware(['partner_admin', 'super_admin']), async (req, res) => {
  const { demo_batch_id, scheduled_class_id, demo_duration_hours } = req.body;
  
  try {
    await getPool().query(
      `UPDATE demo_access_requests 
       SET status='approved', demo_batch_id=?, scheduled_demo_class_id=?,
       demo_duration_hours=?, approved_at=NOW(), approved_by=?
       WHERE id=?`,
      [demo_batch_id, scheduled_class_id, demo_duration_hours || 48, req.user.id, req.params.id]
    );
    res.json({ message: 'Demo request approved' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ─── PROGRESS TRACKING ─────────────────────────────────────
app.get('/api/progress/:enrollmentId', authMiddleware(), async (req, res) => {
  const enrollmentId = req.params.enrollmentId;
  const studentId = req.user.id;
  
  try {
    // Verify enrollment belongs to student
    const [[enrollment]] = await getPool().query(
      'SELECT * FROM enrollments WHERE id=? AND student_id=?',
      [enrollmentId, studentId]
    );
    if (!enrollment) return res.status(403).json({ error: 'Access denied' });
    
    const [progress] = await getPool().query(`
      SELECT pt.*, l.title as lesson_title, l.module_name, l.content_type
      FROM progress_tracking pt
      JOIN lessons l ON pt.lesson_id = l.id
      WHERE pt.enrollment_id = ?
      ORDER BY l.lesson_order
    `, [enrollmentId]);
    
    res.json({ enrollment_id: enrollmentId, progress });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/progress/update', authMiddleware(['student']), async (req, res) => {
  const { enrollment_id, lesson_id, video_watched_seconds, video_total_seconds, status } = req.body;
  const studentId = req.user.id;
  
  try {
    const completionPercent = video_total_seconds > 0
      ? Math.round((video_watched_seconds / video_total_seconds) * 100)
      : 0;
    
    await getPool().query(`
      INSERT INTO progress_tracking (enrollment_id, student_id, course_id, lesson_id,
        video_watched_seconds, video_total_seconds, video_completion_percent, status,
        first_accessed_at, last_watched_at)
      SELECT ?, ?, e.course_id, ?, ?, ?, ?, ?,
        COALESCE((SELECT first_accessed_at FROM progress_tracking WHERE enrollment_id=? AND lesson_id=?), NOW()),
        NOW()
      FROM enrollments e WHERE e.id = ?
      ON DUPLICATE KEY UPDATE
        video_watched_seconds = VALUES(video_watched_seconds),
        video_completion_percent = VALUES(video_completion_percent),
        status = VALUES(status),
        last_watched_at = NOW()
    `, [enrollment_id, studentId, lesson_id, video_watched_seconds, video_total_seconds,
        completionPercent, status, enrollment_id, lesson_id, enrollment_id]);
    
    res.json({ message: 'Progress updated', completion_percent: completionPercent });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── DB Connection Retry ─────────────────────────────────────
async function checkDBConnection() {
  try {
    await getPool().query('SELECT 1');
    dbConnected = true;
    console.log('✅ Database connected');
  } catch (err) {
    dbConnected = false;
    console.log('⏳ Waiting for database...');
    setTimeout(checkDBConnection, 3000);
  }
}

// ─── START ────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
const HOST = '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`\n🚀 TestPrepGPT API running at http://${HOST}:${PORT}`);
  console.log(`📋 Health check: http://${HOST}:${PORT}/api/health\n`);
  checkDBConnection();
});
