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
app.use(express.json({ limit: '16mb' })); // allow base64 logo + QR code uploads

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

// ─── JaaS (8x8 Jitsi as a Service) config ────────────────────
const JAAS_APP_ID = process.env.JAAS_APP_ID || '';
const JAAS_API_KEY_ID = process.env.JAAS_API_KEY_ID || '';
const JAAS_PRIVATE_KEY = (process.env.JAAS_PRIVATE_KEY || '').replace(/\\n/g, '\n');

function generateJaaSToken({ userId, userName, userEmail, roomName, isModerator }) {
  if (!JAAS_APP_ID || !JAAS_PRIVATE_KEY) return null;
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: 'chat',
    iat: now,
    exp: now + 7200,
    nbf: now - 10,
    aud: 'jitsi',
    sub: JAAS_APP_ID,
    context: {
      user: {
        id: String(userId),
        name: userName || userEmail || 'User',
        email: userEmail || '',
        moderator: isModerator,
        'hidden-from-recorder': false
      },
      features: {
        recording: isModerator,
        livestreaming: isModerator,
        transcription: false,
        'outbound-call': false
      }
    },
    room: roomName
  };
  try {
    return jwt.sign(payload, JAAS_PRIVATE_KEY, {
      algorithm: 'RS256',
      header: { alg: 'RS256', kid: JAAS_API_KEY_ID, typ: 'JWT' }
    });
  } catch (e) {
    console.error('JaaS JWT error:', e.message);
    return null;
  }
}

// ─── Auth Middleware ─────────────────────────────────────────
function authMiddleware(roles = []) {
  return async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      if (roles.length && !roles.includes(decoded.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      // Check if user has been disabled (skip for super_admin)
      if (decoded.role !== 'super_admin') {
        const [[u]] = await getPool().query('SELECT is_active FROM users WHERE id=?', [decoded.id]).catch(() => [[{ is_active: 1 }]]);
        if (u && u.is_active === 0) {
          return res.status(403).json({ error: 'Account disabled. Contact your administrator.' });
        }
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
      'SELECT u.*, a.name as agency_name, a.slug, a.brand_color, a.logo_initials, a.logo_url, a.commission_rate, a.visible_sections, a.layout_type FROM users u LEFT JOIN agencies a ON u.agency_id = a.id WHERE u.email = ?',
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
        slug: user.slug, agency_slug: user.slug,
        brand_color: user.brand_color, logo_initials: user.logo_initials,
        logo_url: user.logo_url, commission_rate: user.commission_rate
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Student self-registration (with optional agency slug for partner-referred signups)
app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password, phone, agency_slug } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  try {
    // Check email not already taken
    const [[existing]] = await getPool().query('SELECT id FROM users WHERE email=?', [email]);
    if (existing) return res.status(400).json({ error: 'An account with this email already exists' });

    // Resolve agency from slug if provided
    let agencyId = null;
    if (agency_slug) {
      const [[agency]] = await getPool().query('SELECT id FROM agencies WHERE slug=? AND status="active"', [agency_slug]);
      if (agency) agencyId = agency.id;
    }

    const hash = await bcrypt.hash(password, 10);
    const [result] = await getPool().query(
      `INSERT INTO users (name, email, password_hash, role, phone, agency_id, is_active) VALUES (?,?,?,'student',?,?,1)`,
      [name.trim(), email.toLowerCase().trim(), hash, phone || null, agencyId]
    );

    // Auto-login: return token
    const [[newUser]] = await getPool().query(
      'SELECT u.*, a.name as agency_name, a.slug, a.brand_color, a.logo_initials, a.logo_url, a.commission_rate, a.visible_sections, a.layout_type FROM users u LEFT JOIN agencies a ON u.agency_id = a.id WHERE u.id=?',
      [result.insertId]
    );
    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, role: 'student', agency_id: agencyId },
      JWT_SECRET, { expiresIn: '24h' }
    );
    res.json({
      token,
      user: {
        id: newUser.id, name: newUser.name, email: newUser.email, role: 'student',
        agency_id: agencyId, agency_name: newUser.agency_name,
        slug: newUser.slug, agency_slug: newUser.slug,
        brand_color: newUser.brand_color, logo_initials: newUser.logo_initials,
        logo_url: newUser.logo_url, commission_rate: newUser.commission_rate
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/auth/me', authMiddleware(), async (req, res) => {
  try {
    const [rows] = await getPool().query(
      'SELECT u.id, u.name, u.email, u.role, u.agency_id, u.phone, u.lms_user_id, a.name as agency_name, a.slug, a.brand_color, a.logo_initials, a.logo_url, a.commission_rate, a.email as agency_email, a.phone as agency_phone, a.city, a.visible_sections, a.layout_type FROM users u LEFT JOIN agencies a ON u.agency_id = a.id WHERE u.id = ?',
      [req.user.id]
    );
    const row = rows[0];
    res.json({ ...row, agency_slug: row?.slug }); // normalize agency_slug alias
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
  try {
    const [[old]] = await getPool().query('SELECT name,email,phone,city,brand_color,commission_rate,status FROM agencies WHERE id=?', [req.params.id]);
    await getPool().query(
      'UPDATE agencies SET name=?, email=?, phone=?, city=?, brand_color=?, commission_rate=?, status=? WHERE id=?',
      [name, email, phone, city, brand_color, commission_rate, status, req.params.id]
    );
    const changes = {};
    if (old) {
      if (name !== old.name) changes.name = { from: old.name, to: name };
      if (email !== old.email) changes.email = { from: old.email, to: email };
      if (phone !== old.phone) changes.phone = { from: old.phone, to: phone };
      if (city !== old.city) changes.city = { from: old.city, to: city };
      if (brand_color !== old.brand_color) changes.brand_color = { from: old.brand_color, to: brand_color };
      if (String(commission_rate) !== String(old.commission_rate)) changes.commission_rate = { from: old.commission_rate, to: commission_rate };
      if (status !== old.status) changes.status = { from: old.status, to: status };
    }
    if (Object.keys(changes).length > 0) {
      await getPool().query(
        'INSERT INTO agency_edit_history (agency_id, changed_by_user_id, changed_by_name, changed_by_role, changes_json) VALUES (?,?,?,?,?)',
        [req.params.id, req.user.id, req.user.name || 'Admin', 'super_admin', JSON.stringify(changes)]
      );
    }
    res.json({ message: 'Updated' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Admin: upload logo for any agency (base64 data URI)
app.post('/api/admin/agencies/:id/logo', authMiddleware(['super_admin']), async (req, res) => {
  const { logo_url } = req.body;
  if (!logo_url) return res.status(400).json({ error: 'logo_url required' });
  await getPool().query('UPDATE agencies SET logo_url=? WHERE id=?', [logo_url, req.params.id]);
  res.json({ message: 'Logo updated', logo_url });
});

// Partner: upload their own logo
app.post('/api/partner/logo', authMiddleware(['partner_admin']), async (req, res) => {
  const { logo_url } = req.body;
  if (!logo_url) return res.status(400).json({ error: 'logo_url required' });
  const agencyId = req.user.agency_id;
  if (!agencyId) return res.status(400).json({ error: 'No agency linked' });
  await getPool().query('UPDATE agencies SET logo_url=? WHERE id=?', [logo_url, agencyId]);
  res.json({ message: 'Logo updated', logo_url });
});

// Partner: get own agency profile
app.get('/api/partner/agency-profile', authMiddleware(['partner_admin']), async (req, res) => {
  try {
    const [[agency]] = await getPool().query(
      'SELECT id, name, email, phone, city, brand_color, logo_url, logo_initials, slug, commission_rate, partner_edit_count, visible_sections, layout_type FROM agencies WHERE id=?',
      [req.user.agency_id]
    );
    res.json(agency || {});
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Partner: update own agency profile (max 2 edits)
app.put('/api/partner/agency-profile', authMiddleware(['partner_admin']), async (req, res) => {
  try {
    const [[agency]] = await getPool().query('SELECT * FROM agencies WHERE id=?', [req.user.agency_id]);
    if (!agency) return res.status(404).json({ error: 'Agency not found' });
    if (agency.partner_edit_count >= 2) return res.status(403).json({ error: 'Edit limit reached. Only admin can make further changes.' });

    const { name, email, phone, city, brand_color, logo_url } = req.body;
    const changes = {};
    if (name && name !== agency.name) changes.name = { from: agency.name, to: name };
    if (email && email !== agency.email) changes.email = { from: agency.email, to: email };
    if (phone && phone !== agency.phone) changes.phone = { from: agency.phone, to: phone };
    if (city && city !== agency.city) changes.city = { from: agency.city, to: city };
    if (brand_color && brand_color !== agency.brand_color) changes.brand_color = { from: agency.brand_color, to: brand_color };
    if (logo_url !== undefined && logo_url !== agency.logo_url) changes.logo_url = { from: 'previous', to: 'updated' };

    await getPool().query(
      'UPDATE agencies SET name=?, email=?, phone=?, city=?, brand_color=?, partner_edit_count=partner_edit_count+1 WHERE id=?',
      [name||agency.name, email||agency.email, phone||agency.phone, city||agency.city, brand_color||agency.brand_color, req.user.agency_id]
    );
    if (logo_url !== undefined) {
      await getPool().query('UPDATE agencies SET logo_url=? WHERE id=?', [logo_url||null, req.user.agency_id]);
    }
    await getPool().query(
      'INSERT INTO agency_edit_history (agency_id, changed_by_user_id, changed_by_name, changed_by_role, changes_json) VALUES (?,?,?,?,?)',
      [req.user.agency_id, req.user.id, req.user.name, 'partner_admin', JSON.stringify(changes)]
    );
    const [[updated]] = await getPool().query('SELECT partner_edit_count FROM agencies WHERE id=?', [req.user.agency_id]);
    res.json({ message: 'Profile updated', edits_used: updated.partner_edit_count, edits_remaining: 2 - updated.partner_edit_count });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Partner: get own agency edit history
app.get('/api/partner/agency-profile/history', authMiddleware(['partner_admin']), async (req, res) => {
  try {
    const [rows] = await getPool().query(
      'SELECT * FROM agency_edit_history WHERE agency_id=? ORDER BY changed_at DESC',
      [req.user.agency_id]
    );
    res.json(rows);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Admin: get edit history for any agency
app.get('/api/admin/agencies/:id/history', authMiddleware(['super_admin']), async (req, res) => {
  try {
    const [rows] = await getPool().query(
      'SELECT * FROM agency_edit_history WHERE agency_id=? ORDER BY changed_at DESC',
      [req.params.id]
    );
    res.json(rows);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Admin: reset partner edit count
app.put('/api/admin/agencies/:id/reset-edits', authMiddleware(['super_admin']), async (req, res) => {
  try {
    await getPool().query('UPDATE agencies SET partner_edit_count=0 WHERE id=?', [req.params.id]);
    await getPool().query(
      'INSERT INTO agency_edit_history (agency_id, changed_by_user_id, changed_by_name, changed_by_role, changes_json) VALUES (?,?,?,?,?)',
      [req.params.id, req.user.id, req.user.name || 'Admin', 'super_admin', JSON.stringify({ action: 'edit_count_reset' })]
    );
    res.json({ message: 'Edit count reset to 0' });
  } catch (e) { res.status(400).json({ error: e.message }); }
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
    SELECT e.*, u.name as student_name, u.email as student_email, u.phone as student_phone,
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
    SELECT e.id, e.course_id, e.fee_paid, e.payment_status, e.enrolled_at, e.progress_percent, e.status,
      c.title as course_title, c.category, c.duration_weeks,
      a.name as agency_name, a.brand_color, a.logo_initials, a.logo_url as agency_logo_url, a.slug as agency_slug, a.email as agency_email
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

// ─── FACULTY MANAGEMENT ──────────────────────────────────────

// ─── ADMIN: USER MANAGEMENT ──────────────────────────────────

// List all users (with optional role/agency filter)
app.get('/api/admin/users', authMiddleware(['super_admin']), async (req, res) => {
  const { role, agency_id, search } = req.query;
  let where = '1=1';
  const params = [];
  if (role) { where += ' AND u.role = ?'; params.push(role); }
  if (agency_id) { where += ' AND u.agency_id = ?'; params.push(agency_id); }
  if (search) { where += ' AND (u.name LIKE ? OR u.email LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

  const [rows] = await getPool().query(`
    SELECT u.id, u.name, u.email, u.role, u.phone, u.agency_id,
           u.is_active, u.created_at,
           a.name as agency_name
    FROM users u
    LEFT JOIN agencies a ON u.agency_id = a.id
    WHERE ${where}
    ORDER BY u.role ASC, u.created_at DESC
  `, params);
  res.json(rows);
});

// Edit a user (name, email, phone, role, agency_id)
app.put('/api/admin/users/:id', authMiddleware(['super_admin']), async (req, res) => {
  const { name, email, phone, role, agency_id, password } = req.body;
  const userId = req.params.id;
  try {
    // Prevent disabling or downgrading yourself
    if (String(userId) === String(req.user.id) && role && role !== 'super_admin') {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }
    let query = `UPDATE users SET name=?, email=?, phone=?, role=?, agency_id=? WHERE id=?`;
    const params = [name, email, phone || null, role, agency_id || null, userId];
    if (password && password.length >= 6) {
      const hash = await bcrypt.hash(password, 10);
      query = `UPDATE users SET name=?, email=?, phone=?, role=?, agency_id=?, password_hash=? WHERE id=?`;
      params.splice(5, 0, hash);
    }
    await getPool().query(query, params);
    res.json({ message: 'User updated' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Toggle enable/disable a user
app.put('/api/admin/users/:id/toggle-active', authMiddleware(['super_admin']), async (req, res) => {
  const userId = req.params.id;
  if (String(userId) === String(req.user.id)) {
    return res.status(400).json({ error: 'Cannot disable your own account' });
  }
  try {
    await getPool().query(
      `UPDATE users SET is_active = 1 - is_active WHERE id=?`, [userId]
    );
    const [[u]] = await getPool().query('SELECT is_active FROM users WHERE id=?', [userId]);
    res.json({ is_active: u.is_active, message: u.is_active ? 'User enabled' : 'User disabled' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// List faculty — admin sees all, partner sees own agency
app.get('/api/admin/faculty', authMiddleware(['super_admin']), async (req, res) => {
  const [rows] = await getPool().query(`
    SELECT u.id, u.name, u.email, u.phone, u.agency_id, u.created_at,
      a.name as agency_name,
      COUNT(DISTINCT b.id) as batch_count
    FROM users u
    LEFT JOIN agencies a ON u.agency_id = a.id
    LEFT JOIN batches b ON b.trainer_id = u.id
    WHERE u.role = 'faculty'
    GROUP BY u.id ORDER BY u.created_at DESC
  `);
  res.json(rows);
});

app.get('/api/partner/faculty', authMiddleware(['partner_admin', 'super_admin']), async (req, res) => {
  const agencyId = req.user.role === 'super_admin' ? req.query.agency_id : req.user.agency_id;
  const [rows] = await getPool().query(`
    SELECT u.id, u.name, u.email, u.phone, u.created_at,
      COUNT(DISTINCT b.id) as batch_count
    FROM users u
    LEFT JOIN batches b ON b.trainer_id = u.id AND b.agency_id = ?
    WHERE u.role = 'faculty' AND u.agency_id = ?
    GROUP BY u.id ORDER BY u.name ASC
  `, [agencyId, agencyId]);
  res.json(rows);
});

// Create faculty — admin can create for any agency, partner only for own agency
app.post('/api/admin/faculty', authMiddleware(['super_admin']), async (req, res) => {
  const { name, email, phone, agency_id } = req.body;
  if (!name || !email || !agency_id) return res.status(400).json({ error: 'name, email, agency_id required' });
  try {
    const hash = await bcrypt.hash('Faculty@123', 10);
    const [r] = await getPool().query(
      `INSERT INTO users (name, email, phone, password_hash, role, agency_id) VALUES (?,?,?,?,'faculty',?)`,
      [name, email, phone || null, hash, agency_id]
    );
    res.json({ id: r.insertId, message: 'Faculty created. Default password: Faculty@123' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/partner/faculty', authMiddleware(['partner_admin']), async (req, res) => {
  const { name, email, phone } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'name and email required' });
  try {
    const hash = await bcrypt.hash('Faculty@123', 10);
    const [r] = await getPool().query(
      `INSERT INTO users (name, email, phone, password_hash, role, agency_id) VALUES (?,?,?,?,'faculty',?)`,
      [name, email, phone || null, hash, req.user.agency_id]
    );
    res.json({ id: r.insertId, message: 'Faculty created. Default password: Faculty@123' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Assign faculty to batch
app.put('/api/partner/batches/:id/assign-faculty', authMiddleware(['partner_admin', 'super_admin']), async (req, res) => {
  const { trainer_id } = req.body;
  const batchId = req.params.id;
  try {
    // Verify faculty belongs to the same agency as the batch
    const [[batch]] = await getPool().query('SELECT agency_id FROM batches WHERE id=?', [batchId]);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    if (req.user.role === 'partner_admin' && batch.agency_id !== req.user.agency_id)
      return res.status(403).json({ error: 'Forbidden' });
    if (trainer_id) {
      const [[faculty]] = await getPool().query('SELECT id FROM users WHERE id=? AND role="faculty"', [trainer_id]);
      if (!faculty) return res.status(400).json({ error: 'User is not a faculty member' });
    }
    await getPool().query('UPDATE batches SET trainer_id=? WHERE id=?', [trainer_id || null, batchId]);
    res.json({ message: 'Faculty assigned' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ─── FACULTY DASHBOARD ENDPOINTS ────────────────────────────

// Faculty profile
app.get('/api/faculty/profile', authMiddleware(['faculty']), async (req, res) => {
  const [[user]] = await getPool().query(`
    SELECT u.*, a.name as agency_name, a.brand_color, a.logo_initials
    FROM users u LEFT JOIN agencies a ON u.agency_id = a.id
    WHERE u.id = ?
  `, [req.user.id]);
  res.json(user);
});

// Faculty's assigned batches
app.get('/api/faculty/batches', authMiddleware(['faculty']), async (req, res) => {
  const [rows] = await getPool().query(`
    SELECT b.*, c.title as course_title, c.category, a.name as agency_name, a.brand_color,
      (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = b.course_id AND e.status='active') as enrolled_students,
      (SELECT COUNT(*) FROM live_classes lc WHERE lc.batch_id=b.id AND lc.status IN ('scheduled','live')) as upcoming_classes,
      (SELECT COUNT(*) FROM live_classes lc WHERE lc.batch_id=b.id AND lc.status='ended') as completed_classes
    FROM batches b
    JOIN courses c ON b.course_id = c.id
    JOIN agencies a ON b.agency_id = a.id
    WHERE b.trainer_id = ? AND b.status NOT IN ('cancelled')
    ORDER BY b.start_date DESC
  `, [req.user.id]);
  res.json(rows);
});

// Faculty's live classes (all batches)
app.get('/api/faculty/classes', authMiddleware(['faculty']), async (req, res) => {
  const { scope = 'upcoming' } = req.query;
  let whereStatus = scope === 'past'
    ? `AND lc.status IN ('ended','cancelled','recorded')`
    : `AND lc.status IN ('scheduled','live') AND lc.scheduled_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)`;
  const [rows] = await getPool().query(`
    SELECT lc.*, b.name as batch_name, b.course_id, b.trainer_id,
      c.title as course_title, c.category,
      a.brand_color
    FROM live_classes lc
    JOIN batches b ON lc.batch_id = b.id
    JOIN courses c ON b.course_id = c.id
    JOIN agencies a ON b.agency_id = a.id
    WHERE b.trainer_id = ? ${whereStatus}
    ORDER BY lc.scheduled_at ASC
    LIMIT 50
  `, [req.user.id]);
  res.json(rows);
});

// Faculty schedules a new live class → routes to shared endpoint
app.post('/api/faculty/classes', authMiddleware(['faculty']), async (req, res) => {
  const { batch_id, title, description, scheduled_at, duration_minutes, class_mode } = req.body;
  if (!batch_id || !scheduled_at) return res.status(400).json({ error: 'batch_id and scheduled_at required' });
  try {
    const [[batch]] = await getPool().query(
      `SELECT b.*, a.slug as agency_slug, a.name as agency_name
       FROM batches b JOIN agencies a ON b.agency_id = a.id WHERE b.id=? AND b.trainer_id=?`,
      [batch_id, req.user.id]
    );
    if (!batch) return res.status(403).json({ error: 'You are not assigned to this batch' });

    const autoTitle = title || (() => {
      const dt = scheduled_at ? new Date(scheduled_at) : new Date();
      const datePart = dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      const timePart = dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
      return `${batch.agency_name} – ${batch.name} – ${datePart} ${timePart}`;
    })();

    const roomName = `${batch.agency_slug}-class-${Date.now()}`;
    const [r] = await getPool().query(
      `INSERT INTO live_classes (batch_id, agency_id, title, description, scheduled_at, duration_minutes,
        class_mode, jitsi_room_name, jitsi_meeting_url,
        allow_student_video, allow_student_audio, allow_chat, status, created_by, faculty_id)
       VALUES (?,?,?,?,?,?,?,?,?,1,1,1,'pending_approval',?,?)`,
      [batch_id, batch.agency_id, autoTitle, description || null, scheduled_at,
       duration_minutes || 60, class_mode || 'interactive',
       roomName, `https://8x8.vc/${roomName}`,
       req.user.id, req.user.id]
    );
    res.json({ id: r.insertId, message: 'Class submitted for admin approval', title: autoTitle });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Faculty starts a class (batch trainer OR directly assigned)
app.put('/api/faculty/classes/:id/start', authMiddleware(['faculty']), async (req, res) => {
  try {
    const [[lc]] = await getPool().query(
      `SELECT lc.*, b.trainer_id FROM live_classes lc JOIN batches b ON lc.batch_id=b.id WHERE lc.id=?`,
      [req.params.id]
    );
    if (!lc) return res.status(404).json({ error: 'Class not found' });
    if (lc.faculty_id !== req.user.id && lc.trainer_id !== req.user.id) {
      return res.status(403).json({ error: 'Not assigned to this class' });
    }
    if (lc.status === 'pending_approval') {
      return res.status(403).json({ error: 'Class not yet approved by admin' });
    }
    await getPool().query(
      `UPDATE live_classes SET status='live', started_at=NOW() WHERE id=?`, [req.params.id]
    );
    res.json({ message: 'Class is now live', jitsi_room_name: lc.jitsi_room_name });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Faculty ends a class
app.put('/api/faculty/classes/:id/end', authMiddleware(['faculty']), async (req, res) => {
  try {
    const [[lc]] = await getPool().query(
      `SELECT lc.*, b.trainer_id FROM live_classes lc JOIN batches b ON lc.batch_id=b.id WHERE lc.id=?`,
      [req.params.id]
    );
    if (!lc) return res.status(404).json({ error: 'Class not found' });
    if (lc.faculty_id !== req.user.id && lc.trainer_id !== req.user.id) {
      return res.status(403).json({ error: 'Not assigned to this class' });
    }
    await getPool().query(
      `UPDATE live_classes SET status='ended', ended_at=NOW() WHERE id=?`, [req.params.id]
    );
    res.json({ message: 'Class ended' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Faculty edits their own scheduled class
app.put('/api/faculty/classes/:id', authMiddleware(['faculty']), async (req, res) => {
  const { title, description, scheduled_at, duration_minutes, class_mode } = req.body;
  try {
    const [[lc]] = await getPool().query(
      `SELECT lc.*, b.trainer_id FROM live_classes lc JOIN batches b ON lc.batch_id=b.id WHERE lc.id=?`,
      [req.params.id]
    );
    if (!lc) return res.status(404).json({ error: 'Class not found' });
    if (lc.faculty_id !== req.user.id && lc.trainer_id !== req.user.id) {
      return res.status(403).json({ error: 'Not assigned to this class' });
    }
    if (lc.status === 'live' || lc.status === 'ended') {
      return res.status(400).json({ error: 'Cannot edit a live or ended class' });
    }
    await getPool().query(
      `UPDATE live_classes SET title=?, description=?, scheduled_at=?, duration_minutes=?, class_mode=?, updated_at=NOW() WHERE id=?`,
      [title, description, scheduled_at, duration_minutes, class_mode, req.params.id]
    );
    res.json({ message: 'Class updated' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ─── CLASS ACCESS COUPONS ─────────────────────────────────────

// Admin: create coupon
app.post('/api/admin/class-coupons', authMiddleware(['super_admin']), async (req, res) => {
  const { code, agency_id, description, access_type, allowed_count, max_redemptions, expires_at } = req.body;
  if (!code) return res.status(400).json({ error: 'code is required' });
  try {
    const [r] = await getPool().query(
      `INSERT INTO class_access_coupons (code, agency_id, description, access_type, allowed_count, max_redemptions, expires_at, created_by)
       VALUES (?,?,?,?,?,?,?,?)`,
      [code.toUpperCase(), agency_id || null, description || null,
       access_type || 'class_count', allowed_count || 5, max_redemptions || 100,
       expires_at || null, req.user.id]
    );
    res.json({ id: r.insertId, message: 'Coupon created' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Admin: list all class coupons
app.get('/api/admin/class-coupons', authMiddleware(['super_admin']), async (req, res) => {
  const [rows] = await getPool().query(`
    SELECT cac.*, a.name as agency_name, a.brand_color,
      (SELECT COUNT(*) FROM coupon_redemptions cr WHERE cr.coupon_id = cac.id) as redemption_count
    FROM class_access_coupons cac
    LEFT JOIN agencies a ON cac.agency_id = a.id
    ORDER BY cac.created_at DESC
  `);
  res.json(rows);
});

// Admin: toggle coupon status
app.put('/api/admin/class-coupons/:id', authMiddleware(['super_admin']), async (req, res) => {
  const { is_active, allowed_count, max_redemptions, expires_at } = req.body;
  await getPool().query(
    `UPDATE class_access_coupons SET is_active=?, allowed_count=?, max_redemptions=?, expires_at=? WHERE id=?`,
    [is_active, allowed_count, max_redemptions, expires_at || null, req.params.id]
  );
  res.json({ message: 'Updated' });
});

// Partner: see coupons for their agency
app.get('/api/partner/class-coupons', authMiddleware(['partner_admin']), async (req, res) => {
  const [rows] = await getPool().query(`
    SELECT cac.*,
      (SELECT COUNT(*) FROM coupon_redemptions cr WHERE cr.coupon_id = cac.id) as redemption_count
    FROM class_access_coupons cac
    WHERE (cac.agency_id = ? OR cac.agency_id IS NULL) AND cac.is_active = 1
    ORDER BY cac.created_at DESC
  `, [req.user.agency_id]);
  res.json(rows);
});

// Student: redeem a coupon
app.post('/api/student/redeem-coupon', authMiddleware(['student']), async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Coupon code required' });
  try {
    const [[coupon]] = await getPool().query(`
      SELECT * FROM class_access_coupons
      WHERE code = ? AND is_active = 1
        AND (expires_at IS NULL OR expires_at >= CURDATE())
        AND (agency_id IS NULL OR agency_id = ?)
        AND used_count < max_redemptions
    `, [code.toUpperCase(), req.user.agency_id]);
    if (!coupon) return res.status(404).json({ error: 'Invalid, expired, or already fully used coupon code' });

    // Check if already redeemed
    const [[existing]] = await getPool().query(
      'SELECT id FROM coupon_redemptions WHERE coupon_id=? AND student_id=?',
      [coupon.id, req.user.id]
    );
    if (existing) return res.status(400).json({ error: 'You have already redeemed this coupon' });

    await getPool().query(
      'INSERT INTO coupon_redemptions (coupon_id, student_id) VALUES (?,?)',
      [coupon.id, req.user.id]
    );
    await getPool().query('UPDATE class_access_coupons SET used_count = used_count + 1 WHERE id=?', [coupon.id]);

    const label = coupon.access_type === 'class_count'
      ? `${coupon.allowed_count} live classes`
      : coupon.access_type === 'hour_count'
        ? `${coupon.allowed_count} hours of content`
        : 'unlimited access';
    res.json({ message: `Coupon redeemed! You now have access to ${label}.`, coupon });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Student: see their active coupons
app.get('/api/student/my-coupons', authMiddleware(['student']), async (req, res) => {
  const [rows] = await getPool().query(`
    SELECT cac.code, cac.description, cac.access_type, cac.allowed_count,
      cr.classes_used, cr.minutes_used, cr.redeemed_at, cac.expires_at,
      (cac.allowed_count - cr.classes_used) as remaining
    FROM coupon_redemptions cr
    JOIN class_access_coupons cac ON cr.coupon_id = cac.id
    WHERE cr.student_id = ? AND cac.is_active = 1
      AND (cac.expires_at IS NULL OR cac.expires_at >= CURDATE())
    ORDER BY cr.redeemed_at DESC
  `, [req.user.id]);
  res.json(rows);
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
  const isFaculty = req.user.role === 'faculty';

  let query, params;
  if (isFaculty) {
    // Faculty sees classes assigned to them or in their batches
    query = `SELECT lc.*, b.name as batch_name, c.title as course_title,
        a.name as agency_name,
        u.name as faculty_name
       FROM live_classes lc
       JOIN batches b ON lc.batch_id = b.id
       JOIN courses c ON b.course_id = c.id
       JOIN agencies a ON lc.agency_id = a.id
       LEFT JOIN users u ON lc.faculty_id = u.id
       WHERE lc.faculty_id = ? OR b.trainer_id = ?
       ORDER BY lc.scheduled_at DESC`;
    params = [req.user.id, req.user.id];
  } else if (isAdmin) {
    query = `SELECT lc.*, b.name as batch_name, c.title as course_title,
        a.name as agency_name,
        u.name as faculty_name
       FROM live_classes lc
       JOIN batches b ON lc.batch_id = b.id
       JOIN courses c ON b.course_id = c.id
       JOIN agencies a ON lc.agency_id = a.id
       LEFT JOIN users u ON lc.faculty_id = u.id
       ORDER BY lc.scheduled_at DESC`;
    params = [];
  } else {
    query = `SELECT lc.*, b.name as batch_name, c.title as course_title,
        u.name as faculty_name
       FROM live_classes lc
       JOIN batches b ON lc.batch_id = b.id
       JOIN courses c ON b.course_id = c.id
       LEFT JOIN users u ON lc.faculty_id = u.id
       WHERE lc.agency_id = ?
       ORDER BY lc.scheduled_at DESC`;
    params = [agencyId];
  }

  const [rows] = await getPool().query(query, params);
  res.json(rows);
});

app.get('/api/live-classes/upcoming', authMiddleware(), async (req, res) => {
  const agencyId = req.user.agency_id;
  const isAdmin = req.user.role === 'super_admin';
  const studentId = req.user.role === 'student' ? req.user.id : null;
  
  let query, params;
  
  if (studentId) {
    // Student view - only classes for courses they've purchased
    query = `SELECT lc.*, b.name as batch_name, c.title as course_title
       FROM live_classes lc
       JOIN batches b ON lc.batch_id = b.id
       JOIN courses c ON b.course_id = c.id
       JOIN enrollments e ON e.course_id = c.id AND e.student_id = ? AND e.status = 'active'
       WHERE (lc.status = 'live' OR (lc.status = 'scheduled' AND lc.scheduled_at >= DATE_SUB(NOW(), INTERVAL 30 MINUTE)))
       ORDER BY lc.status = 'live' DESC, lc.scheduled_at ASC
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
    duration_minutes, class_mode, auto_record, faculty_id
  } = req.body;

  try {
    const [[batch]] = await getPool().query(
      `SELECT b.*, a.slug as agency_slug, a.name as agency_name
       FROM batches b JOIN agencies a ON b.agency_id = a.id WHERE b.id=?`,
      [batch_id]
    );
    if (!batch) return res.status(404).json({ error: 'Batch not found' });

    if (req.user.role === 'partner_admin' && batch.agency_id !== req.user.agency_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Auto-generate title: "Agency – Batch – Date Time" if not provided
    const autoTitle = title || (() => {
      const dt = scheduled_at ? new Date(scheduled_at) : new Date();
      const datePart = dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      const timePart = dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
      return `${batch.agency_name} – ${batch.name} – ${datePart} ${timePart}`;
    })();

    const roomName = `${batch.jitsi_room_prefix || batch.agency_slug}-class-${Date.now()}`;
    const meetingUrl = `https://8x8.vc/${roomName}`;

    const [result] = await getPool().query(
      `INSERT INTO live_classes (batch_id, agency_id, title, description, lesson_id,
        scheduled_at, duration_minutes, jitsi_room_name, jitsi_meeting_url,
        class_mode, auto_record, created_by, faculty_id, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [batch_id, batch.agency_id, autoTitle, description, lesson_id,
       scheduled_at, duration_minutes || 60, roomName, meetingUrl,
       class_mode || 'interactive', auto_record || 0, req.user.id,
       faculty_id || null, 'scheduled']
    );

    res.json({
      id: result.insertId,
      message: 'Live class scheduled',
      title: autoTitle,
      jitsi_room_name: roomName
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Faculty creates a class → pending_approval until admin approves
app.post('/api/faculty/live-classes', authMiddleware(['faculty']), async (req, res) => {
  const { batch_id, title, description, scheduled_at, duration_minutes, class_mode } = req.body;
  try {
    const [[batch]] = await getPool().query(
      `SELECT b.*, a.slug as agency_slug, a.name as agency_name
       FROM batches b JOIN agencies a ON b.agency_id = a.id WHERE b.id=?`,
      [batch_id]
    );
    if (!batch) return res.status(404).json({ error: 'Batch not found' });

    // Faculty can only create classes for batches assigned to them
    const [[assigned]] = await getPool().query(
      'SELECT id FROM batches WHERE id = ? AND trainer_id = ?',
      [batch_id, req.user.id]
    );
    if (!assigned) return res.status(403).json({ error: 'Not assigned to this batch' });

    const autoTitle = title || (() => {
      const dt = scheduled_at ? new Date(scheduled_at) : new Date();
      const datePart = dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      const timePart = dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
      return `${batch.agency_name} – ${batch.name} – ${datePart} ${timePart}`;
    })();

    const roomName = `${batch.jitsi_room_prefix || batch.agency_slug}-class-${Date.now()}`;
    const meetingUrl = `https://8x8.vc/${roomName}`;

    const [result] = await getPool().query(
      `INSERT INTO live_classes (batch_id, agency_id, title, description,
        scheduled_at, duration_minutes, jitsi_room_name, jitsi_meeting_url,
        class_mode, created_by, faculty_id, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [batch_id, batch.agency_id, autoTitle, description,
       scheduled_at, duration_minutes || 60, roomName, meetingUrl,
       class_mode || 'interactive', req.user.id, req.user.id, 'pending_approval']
    );

    res.json({ id: result.insertId, message: 'Class submitted for admin approval', title: autoTitle });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Admin ends a live class
app.put('/api/admin/live-classes/:id/end', authMiddleware(['super_admin', 'partner_admin']), async (req, res) => {
  const classId = req.params.id;
  try {
    const [[lc]] = await getPool().query('SELECT agency_id FROM live_classes WHERE id=?', [classId]);
    if (!lc) return res.status(404).json({ error: 'Class not found' });
    if (req.user.role === 'partner_admin' && lc.agency_id !== req.user.agency_id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    await getPool().query(
      `UPDATE live_classes SET status='ended', ended_at=NOW() WHERE id=?`, [classId]
    );
    res.json({ message: 'Class ended' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Admin approves a faculty-created class
app.put('/api/admin/live-classes/:id/approve', authMiddleware(['super_admin', 'partner_admin']), async (req, res) => {
  const classId = req.params.id;
  try {
    const [[lc]] = await getPool().query('SELECT * FROM live_classes WHERE id=?', [classId]);
    if (!lc) return res.status(404).json({ error: 'Class not found' });
    if (req.user.role === 'partner_admin' && lc.agency_id !== req.user.agency_id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    await getPool().query(
      `UPDATE live_classes SET status='scheduled', approved_by=? WHERE id=?`,
      [req.user.id, classId]
    );
    res.json({ message: 'Class approved and scheduled' });
  } catch (e) {
    res.status(500).json({ error: e.message });
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
    const [[liveClass]] = await getPool().query(`
      SELECT lc.*, b.agency_id, b.name as batch_name, b.course_id,
        c.title as course_title, c.price as course_price
      FROM live_classes lc
      JOIN batches b ON lc.batch_id = b.id
      JOIN courses c ON b.course_id = c.id
      WHERE lc.id = ?
    `, [classId]);

    if (!liveClass) return res.status(404).json({ error: 'Live class not found' });

    let isModerator = false;
    let canJoin = false;
    let isDemo = false;

    if (userRole === 'super_admin') {
      canJoin = true;
      isModerator = true;
    } else if (userRole === 'partner_admin') {
      canJoin = liveClass.agency_id === req.user.agency_id;
      isModerator = true;
    } else if (userRole === 'faculty') {
      // Faculty is moderator if directly assigned or batch trainer
      const isAssigned = liveClass.faculty_id === userId;
      const [[batchTrainer]] = await getPool().query(
        'SELECT id FROM batches WHERE id = ? AND trainer_id = ?',
        [liveClass.batch_id, userId]
      );
      if (isAssigned || batchTrainer) {
        canJoin = true;
        isModerator = true;
      }
    } else if (userRole === 'student') {
      // 1. Paid enrollment → full access
      const [[enrollment]] = await getPool().query(`
        SELECT e.id FROM enrollments e
        WHERE e.course_id = ? AND e.student_id = ? AND e.status = 'active' AND e.payment_status = 'paid'
        LIMIT 1
      `, [liveClass.course_id, userId]);

      if (enrollment) {
        canJoin = true;
      } else {
        // 2. Valid class-access coupon → full access (tracks usage)
        const [[couponAccess]] = await getPool().query(`
          SELECT cr.id, cr.classes_used, cac.access_type, cac.allowed_count, cac.code
          FROM coupon_redemptions cr
          JOIN class_access_coupons cac ON cr.coupon_id = cac.id
          WHERE cr.student_id = ? AND cac.is_active = 1
            AND (cac.expires_at IS NULL OR cac.expires_at >= CURDATE())
            AND (cac.agency_id IS NULL OR cac.agency_id = ?)
            AND (cac.access_type = 'unlimited' OR cr.classes_used < cac.allowed_count)
          LIMIT 1
        `, [userId, liveClass.agency_id]);

        if (couponAccess) {
          canJoin = true;
          // Increment class usage counter
          await getPool().query(
            'UPDATE coupon_redemptions SET classes_used = classes_used + 1 WHERE id = ?',
            [couponAccess.id]
          );
          res._couponInfo = {
            code: couponAccess.code,
            access_type: couponAccess.access_type,
            remaining: couponAccess.access_type === 'unlimited'
              ? null
              : couponAccess.allowed_count - couponAccess.classes_used - 1
          };
        } else {
          // 3. Demo mode — ANY student can join any class for 15 min free preview
          canJoin = true;
          isDemo = true;
        }
      }
    }

    if (!canJoin) return res.status(403).json({ error: 'Not enrolled in this batch' });

    try {
      await getPool().query(`
        INSERT INTO class_attendance (live_class_id, student_id, batch_id, joined_at, attendance_status)
        VALUES (?, ?, ?, NOW(), 'present')
        ON DUPLICATE KEY UPDATE joined_at = NOW(), attendance_status = 'present'
      `, [classId, userId, liveClass.batch_id]);
    } catch (_) { /* attendance table may not exist yet */ }

    const meetingUrl = isModerator && liveClass.jitsi_moderator_url
      ? liveClass.jitsi_moderator_url
      : liveClass.jitsi_meeting_url;

    const jaasToken = generateJaaSToken({
      userId,
      userName: req.user.name,
      userEmail: req.user.email,
      roomName: liveClass.jitsi_room_name,
      isModerator
    });

    res.json({
      class_id: classId,
      title: liveClass.title,
      jitsi_room_name: liveClass.jitsi_room_name,
      jitsi_meeting_url: meetingUrl,
      is_moderator: isModerator,
      is_demo: isDemo,
      demo_minutes: isDemo ? 15 : null,
      coupon_info: res._couponInfo || null,
      course_id: liveClass.course_id,
      course_title: liveClass.course_title,
      course_price: Number(liveClass.course_price),
      agency_id: liveClass.agency_id,
      class_mode: liveClass.class_mode,
      duration_minutes: liveClass.duration_minutes,
      allow_chat: isDemo ? false : liveClass.allow_chat,
      allow_video: isModerator ? true : (isDemo ? false : liveClass.allow_student_video),
      allow_audio: isModerator ? true : (isDemo ? false : liveClass.allow_student_audio),
      jaas_app_id: JAAS_APP_ID || null,
      jaas_token: jaasToken
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── STUDENT: ALL UPCOMING CLASSES (enrolled + previewable) ───
app.get('/api/student/all-classes', authMiddleware(['student']), async (req, res) => {
  const studentId = req.user.id;
  try {
    const [rows] = await getPool().query(`
      SELECT lc.*, b.name as batch_name, b.course_id,
        c.title as course_title, c.price as course_price, c.category,
        a.name as agency_name,
        (SELECT e.id FROM enrollments e
         WHERE e.course_id = b.course_id AND e.student_id = ? AND e.status = 'active' LIMIT 1) as is_enrolled
      FROM live_classes lc
      JOIN batches b ON lc.batch_id = b.id
      JOIN courses c ON b.course_id = c.id
      JOIN agencies a ON b.agency_id = a.id
      WHERE (
          lc.status = 'live'
          OR (lc.status = 'scheduled' AND lc.scheduled_at >= DATE_SUB(NOW(), INTERVAL 30 MINUTE))
        )
      ORDER BY lc.status = 'live' DESC, lc.scheduled_at ASC
      LIMIT 50
    `, [studentId]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
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

// ─── COURSE CATALOG (Public) ──────────────────────────────────
app.get('/api/catalog', async (req, res) => {
  try {
    const [rows] = await getPool().query(
      'SELECT id, title, category, description, price, duration_weeks FROM courses WHERE is_active=1 ORDER BY category, title'
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── BATCH CATALOG (by agency) ────────────────────────────────
app.get('/api/catalog/batches', async (req, res) => {
  const { agency_id } = req.query;
  const params = [];
  let where = 'WHERE b.status = "active"';
  if (agency_id) { where += ' AND b.agency_id = ?'; params.push(agency_id); }
  try {
    const [rows] = await getPool().query(`
      SELECT b.*, c.title as course_title, c.price as course_price, c.category,
        a.name as agency_name, a.brand_color, a.slug as agency_slug,
        COUNT(DISTINCT be.id) as enrolled_count,
        (SELECT COUNT(*) FROM live_classes lc WHERE lc.batch_id = b.id AND lc.scheduled_at >= NOW()) as upcoming_classes
      FROM batches b
      JOIN courses c ON b.course_id = c.id
      JOIN agencies a ON b.agency_id = a.id
      LEFT JOIN batch_enrollments be ON b.id = be.batch_id AND be.status = 'active'
      ${where}
      GROUP BY b.id ORDER BY b.start_date ASC
    `, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── STUDENT: PURCHASE COURSE ─────────────────────────────────
app.post('/api/student/purchase', authMiddleware(['student']), async (req, res) => {
  const { course_id, coupon_code } = req.body;
  const studentId = req.user.id;
  const agencyId = req.user.agency_id;
  try {
    const [[course]] = await getPool().query('SELECT * FROM courses WHERE id=? AND is_active=1', [course_id]);
    if (!course) return res.status(404).json({ error: 'Course not found' });
    const [[existing]] = await getPool().query(
      'SELECT id FROM enrollments WHERE student_id=? AND course_id=? AND agency_id=?',
      [studentId, course_id, agencyId]
    );
    if (existing) return res.status(400).json({ error: 'Already enrolled in this course' });

    let discount = 0;
    if (coupon_code) {
      const [coup] = await getPool().query(
        'SELECT * FROM coupons WHERE code=? AND agency_id=? AND is_active=1', [coupon_code.toUpperCase(), agencyId]
      );
      if (coup.length) {
        const c = coup[0];
        discount = c.discount_type === 'percentage' ? Math.round(course.price * c.value / 100) : c.value;
        await getPool().query('UPDATE coupons SET used_count=used_count+1 WHERE id=?', [c.id]);
      }
    }
    const finalAmount = Math.max(0, course.price - discount);

    if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
      const Razorpay = require('razorpay');
      const rz = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
      const order = await rz.orders.create({
        amount: finalAmount * 100, currency: 'INR',
        receipt: `enr_${studentId}_${course_id}_${Date.now()}`,
        notes: { student_id: String(studentId), course_id: String(course_id) }
      });
      return res.json({ gateway: 'razorpay', order_id: order.id, amount: finalAmount, discount, key_id: process.env.RAZORPAY_KEY_ID, course_title: course.title });
    }

    // No gateway — pending enrollment
    const [result] = await getPool().query(
      'INSERT INTO enrollments (student_id, agency_id, course_id, fee_paid, coupon_code, discount_amount, payment_status, lms_enrolled) VALUES (?,?,?,?,?,?,"pending",1)',
      [studentId, agencyId, course_id, finalAmount, coupon_code || null, discount]
    );
    res.json({ gateway: 'manual', enrollment_id: result.insertId, amount: finalAmount, discount, course_title: course.title, message: 'Enrolled! Your agency will confirm payment shortly.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── STUDENT: VERIFY RAZORPAY PAYMENT ─────────────────────────
app.post('/api/student/verify-payment', authMiddleware(['student']), async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, course_id, amount, discount } = req.body;
  const studentId = req.user.id;
  const agencyId = req.user.agency_id;
  try {
    const crypto = require('crypto');
    const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
      .update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex');
    if (expected !== razorpay_signature) return res.status(400).json({ error: 'Payment verification failed' });
    const [result] = await getPool().query(
      'INSERT INTO enrollments (student_id, agency_id, course_id, fee_paid, discount_amount, payment_status, payment_date, lms_enrolled) VALUES (?,?,?,?,?,"paid",NOW(),1)',
      [studentId, agencyId, course_id, amount, discount || 0]
    );
    res.json({ success: true, enrollment_id: result.insertId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── STUDENT: AVAILABLE BATCHES ───────────────────────────────
app.get('/api/student/available-batches', authMiddleware(['student']), async (req, res) => {
  const studentId = req.user.id;
  const agencyId = req.user.agency_id;
  try {
    const [rows] = await getPool().query(`
      SELECT b.*, c.title as course_title, c.category, a.brand_color,
        COUNT(DISTINCT be.id) as enrolled_count,
        (SELECT be2.id FROM batch_enrollments be2 WHERE be2.batch_id=b.id AND be2.student_id=? AND be2.status='active' LIMIT 1) as already_joined,
        (SELECT COUNT(*) FROM live_classes lc WHERE lc.batch_id=b.id AND lc.scheduled_at>=NOW() AND lc.status='scheduled') as upcoming_classes
      FROM batches b
      JOIN courses c ON b.course_id=c.id
      JOIN agencies a ON b.agency_id=a.id
      LEFT JOIN batch_enrollments be ON b.id=be.batch_id AND be.status='active'
      WHERE b.agency_id=? AND b.status='active'
      GROUP BY b.id ORDER BY b.start_date ASC
    `, [studentId, agencyId]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── STUDENT: JOIN BATCH ──────────────────────────────────────
app.post('/api/student/join-batch', authMiddleware(['student']), async (req, res) => {
  const { batch_id } = req.body;
  const studentId = req.user.id;
  try {
    const [[batch]] = await getPool().query('SELECT * FROM batches WHERE id=?', [batch_id]);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    const [[enrollment]] = await getPool().query(
      'SELECT id FROM enrollments WHERE student_id=? AND course_id=? AND agency_id=? AND payment_status="paid"',
      [studentId, batch.course_id, batch.agency_id]
    );
    if (!enrollment) return res.status(403).json({ error: 'Please purchase the course first to join this batch' });
    const [[{ n }]] = await getPool().query(
      'SELECT COUNT(*) as n FROM batch_enrollments WHERE batch_id=? AND status="active"', [batch_id]
    );
    if (n >= batch.max_students) return res.status(400).json({ error: 'This batch is full' });
    const [result] = await getPool().query(
      'INSERT INTO batch_enrollments (batch_id, student_id, enrollment_id, access_type, status) VALUES (?,?,?,"full","active")',
      [batch_id, studentId, enrollment.id]
    );
    res.json({ id: result.insertId, message: 'Successfully joined the batch!' });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Already enrolled in this batch' });
    res.status(500).json({ error: e.message });
  }
});

// ─── STUDENT: MY BATCHES ──────────────────────────────────────
app.get('/api/student/my-batches', authMiddleware(['student']), async (req, res) => {
  const studentId = req.user.id;
  try {
    const [rows] = await getPool().query(`
      SELECT be.*, b.name as batch_name, b.schedule_days, b.class_time, b.start_date, b.end_date,
        b.trainer_name, b.duration_minutes, b.timezone,
        c.title as course_title, c.category, a.brand_color,
        (SELECT COUNT(*) FROM live_classes lc WHERE lc.batch_id=b.id AND lc.scheduled_at>=NOW() AND lc.status='scheduled') as upcoming_classes
      FROM batch_enrollments be
      JOIN batches b ON be.batch_id=b.id
      JOIN courses c ON b.course_id=c.id
      JOIN agencies a ON b.agency_id=a.id
      WHERE be.student_id=? AND be.status='active'
      ORDER BY b.start_date ASC
    `, [studentId]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── PARTNER: STUDENT SELF-PURCHASES ──────────────────────────
app.get('/api/partner/purchases', authMiddleware(['partner_admin']), async (req, res) => {
  try {
    const [rows] = await getPool().query(`
      SELECT e.*, u.name as student_name, u.email as student_email, u.phone as student_phone,
        c.title as course_title, c.category
      FROM enrollments e
      JOIN users u ON e.student_id=u.id
      JOIN courses c ON e.course_id=c.id
      WHERE e.agency_id=?
      ORDER BY e.enrolled_at DESC
    `, [req.user.agency_id]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── PAYMENT CONFIG ──────────────────────────────────────────

// Admin: get payment config for their platform (all agencies)
// Admin: get global default payment config
app.get('/api/admin/global-payment-config', authMiddleware(['super_admin']), async (req, res) => {
  try {
    const [[cfg]] = await getPool().query('SELECT * FROM global_payment_config WHERE id=1');
    res.json(cfg || {});
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Admin: save global default payment config
app.put('/api/admin/global-payment-config', authMiddleware(['super_admin']), async (req, res) => {
  const { upi_id, upi_name, qr_code_image, payment_link, mobile_number, mobile_instructions } = req.body;
  try {
    await getPool().query(`
      INSERT INTO global_payment_config (id, upi_id, upi_name, qr_code_image, payment_link, mobile_number, mobile_instructions)
      VALUES (1,?,?,?,?,?,?)
      ON DUPLICATE KEY UPDATE
        upi_id=VALUES(upi_id), upi_name=VALUES(upi_name),
        qr_code_image=VALUES(qr_code_image), payment_link=VALUES(payment_link),
        mobile_number=VALUES(mobile_number), mobile_instructions=VALUES(mobile_instructions)
    `, [upi_id||null, upi_name||null, qr_code_image||null, payment_link||null, mobile_number||null, mobile_instructions||null]);
    res.json({ message: 'Global payment config saved' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Admin: get per-agency overrides
app.get('/api/admin/payment-config', authMiddleware(['super_admin']), async (req, res) => {
  try {
    const [rows] = await getPool().query(`
      SELECT apc.*, a.name as agency_name, a.brand_color, a.can_configure_payment
      FROM agency_payment_config apc
      JOIN agencies a ON apc.agency_id = a.id
      ORDER BY a.name
    `);
    res.json(rows);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Admin: save payment config for a specific agency (override)
app.put('/api/admin/payment-config/:agency_id', authMiddleware(['super_admin']), async (req, res) => {
  const { upi_id, upi_name, qr_code_image, payment_link, mobile_number, mobile_instructions } = req.body;
  try {
    await getPool().query(`
      INSERT INTO agency_payment_config (agency_id, upi_id, upi_name, qr_code_image, payment_link, mobile_number, mobile_instructions)
      VALUES (?,?,?,?,?,?,?)
      ON DUPLICATE KEY UPDATE
        upi_id=VALUES(upi_id), upi_name=VALUES(upi_name),
        qr_code_image=VALUES(qr_code_image), payment_link=VALUES(payment_link),
        mobile_number=VALUES(mobile_number), mobile_instructions=VALUES(mobile_instructions)
    `, [req.params.agency_id, upi_id||null, upi_name||null, qr_code_image||null,
        payment_link||null, mobile_number||null, mobile_instructions||null]);
    res.json({ message: 'Payment config saved' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Admin: toggle partner payment permission
app.put('/api/admin/agencies/:id/payment-permission', authMiddleware(['super_admin']), async (req, res) => {
  const { can_configure_payment } = req.body;
  try {
    await getPool().query('UPDATE agencies SET can_configure_payment=? WHERE id=?', [can_configure_payment ? 1 : 0, req.params.id]);
    res.json({ message: 'Permission updated' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Admin: portal settings (visible sections + layout) for a partner
app.put('/api/admin/agencies/:id/portal-settings', authMiddleware(['super_admin']), async (req, res) => {
  const { visible_sections, layout_type } = req.body;
  try {
    await getPool().query(
      'UPDATE agencies SET visible_sections=?, layout_type=? WHERE id=?',
      [visible_sections ? JSON.stringify(visible_sections) : null, layout_type || 1, req.params.id]
    );
    res.json({ message: 'Portal settings saved' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Student: get payment config — agency override if permitted, else global default
app.get('/api/student/payment-config', authMiddleware(['student']), async (req, res) => {
  try {
    const [[agency]] = await getPool().query(
      'SELECT can_configure_payment, phone, name FROM agencies WHERE id=?', [req.user.agency_id]
    );
    let cfg = null;
    // Use agency-specific config only if admin granted permission
    if (agency?.can_configure_payment) {
      const [[agencyCfg]] = await getPool().query(
        `SELECT upi_id, upi_name, qr_code_image, payment_link, mobile_number, mobile_instructions
         FROM agency_payment_config WHERE agency_id=?`, [req.user.agency_id]
      );
      if (agencyCfg && (agencyCfg.upi_id || agencyCfg.qr_code_image || agencyCfg.payment_link || agencyCfg.mobile_number)) {
        cfg = agencyCfg;
      }
    }
    // Fall back to global default
    if (!cfg) {
      const [[global]] = await getPool().query('SELECT * FROM global_payment_config WHERE id=1');
      cfg = global;
    }
    res.json({ ...(cfg || {}), agency_phone: agency?.phone, agency_name: agency?.name });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Partner: get own payment config (only if permitted)
app.get('/api/partner/payment-config', authMiddleware(['partner_admin']), async (req, res) => {
  try {
    const [[agency]] = await getPool().query('SELECT can_configure_payment FROM agencies WHERE id=?', [req.user.agency_id]);
    if (!agency?.can_configure_payment) return res.status(403).json({ error: 'not_permitted' });
    const [[cfg]] = await getPool().query('SELECT * FROM agency_payment_config WHERE agency_id=?', [req.user.agency_id]);
    res.json(cfg || {});
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Partner: save own payment config (only if permitted)
app.put('/api/partner/payment-config', authMiddleware(['partner_admin']), async (req, res) => {
  const { upi_id, upi_name, qr_code_image, payment_link, mobile_number, mobile_instructions } = req.body;
  try {
    const [[agency]] = await getPool().query('SELECT can_configure_payment FROM agencies WHERE id=?', [req.user.agency_id]);
    if (!agency?.can_configure_payment) return res.status(403).json({ error: 'Contact admin to enable payment configuration' });
    await getPool().query(`
      INSERT INTO agency_payment_config (agency_id, upi_id, upi_name, qr_code_image, payment_link, mobile_number, mobile_instructions)
      VALUES (?,?,?,?,?,?,?)
      ON DUPLICATE KEY UPDATE
        upi_id=VALUES(upi_id), upi_name=VALUES(upi_name),
        qr_code_image=VALUES(qr_code_image), payment_link=VALUES(payment_link),
        mobile_number=VALUES(mobile_number), mobile_instructions=VALUES(mobile_instructions)
    `, [req.user.agency_id, upi_id||null, upi_name||null, qr_code_image||null, payment_link||null, mobile_number||null, mobile_instructions||null]);
    res.json({ message: 'Payment config saved' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Student: submit payment proof (receipt MANDATORY)
app.post('/api/student/payment-proof', authMiddleware(['student']), async (req, res) => {
  const { enrollment_id, amount, payment_method, proof_image, notes } = req.body;
  if (!enrollment_id) return res.status(400).json({ error: 'enrollment_id required' });
  if (!proof_image) return res.status(400).json({ error: 'Payment receipt screenshot is required to submit proof.' });
  try {
    const [[enr]] = await getPool().query(
      `SELECT id, agency_id FROM enrollments WHERE id=? AND student_id=?`,
      [enrollment_id, req.user.id]
    );
    if (!enr) return res.status(404).json({ error: 'Enrollment not found' });
    // Check if a pending proof already exists
    const [[existing]] = await getPool().query(
      'SELECT id FROM payment_proofs WHERE enrollment_id=? AND status="pending"', [enrollment_id]
    );
    if (existing) return res.status(400).json({ error: 'A payment proof is already pending review for this enrollment.' });
    const [r] = await getPool().query(`
      INSERT INTO payment_proofs (enrollment_id, student_id, agency_id, amount, payment_method, proof_image, notes)
      VALUES (?,?,?,?,?,?,?)
    `, [enrollment_id, req.user.id, enr.agency_id, amount||null, payment_method||'other', proof_image, notes||null]);
    res.json({ id: r.insertId, message: 'Payment proof submitted! Your course will be unlocked once the admin verifies your receipt.' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Admin: get all payment proofs
app.get('/api/admin/payments', authMiddleware(['super_admin']), async (req, res) => {
  try {
    const [rows] = await getPool().query(`
      SELECT pp.*,
        u.name as student_name, u.email as student_email, u.phone as student_phone,
        a.name as agency_name, a.brand_color,
        c.title as course_title,
        vu.name as verified_by_name
      FROM payment_proofs pp
      JOIN users u ON pp.student_id = u.id
      JOIN agencies a ON pp.agency_id = a.id
      LEFT JOIN enrollments e ON pp.enrollment_id = e.id
      LEFT JOIN courses c ON e.course_id = c.id
      LEFT JOIN users vu ON pp.verified_by_user_id = vu.id
      ORDER BY pp.created_at DESC
      LIMIT 500
    `);
    res.json(rows);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Admin: verify or reject a payment proof
app.put('/api/admin/payments/:id', authMiddleware(['super_admin']), async (req, res) => {
  const { status, admin_note } = req.body;
  if (!['verified','rejected'].includes(status)) return res.status(400).json({ error: 'status must be verified or rejected' });
  try {
    await getPool().query(
      `UPDATE payment_proofs SET status=?, admin_note=?, verified_by_user_id=?, verified_at=NOW() WHERE id=?`,
      [status, admin_note||null, req.user.id, req.params.id]
    );
    if (status === 'verified') {
      const [[pp]] = await getPool().query(`SELECT enrollment_id FROM payment_proofs WHERE id=?`, [req.params.id]);
      if (pp?.enrollment_id) {
        await getPool().query(
          `UPDATE enrollments SET payment_status='paid', payment_date=NOW() WHERE id=?`, [pp.enrollment_id]
        );
      }
    } else if (status === 'rejected') {
      // Rejected: keep enrollment payment_status as pending (student can resubmit)
      const [[pp]] = await getPool().query(`SELECT enrollment_id FROM payment_proofs WHERE id=?`, [req.params.id]);
      if (pp?.enrollment_id) {
        await getPool().query(
          `UPDATE enrollments SET payment_status='pending' WHERE id=?`, [pp.enrollment_id]
        );
      }
    }
    res.json({ message: `Payment ${status}. ${status==='verified'?'Course access granted.':'Student can resubmit proof.'}` });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ─── DB Connection Retry ─────────────────────────────────────
async function checkDBConnection() {
  try {
    await getPool().query('SELECT 1');
    dbConnected = true;
    console.log('✅ Database connected');
    await runMigrations();
  } catch (err) {
    dbConnected = false;
    console.log('⏳ Waiting for database...');
    setTimeout(checkDBConnection, 3000);
  }
}

async function runMigrations() {
  try {
    // Add faculty to users role enum if not present
    await getPool().query(`
      ALTER TABLE users MODIFY COLUMN role
        ENUM('super_admin','partner_admin','student','faculty') NOT NULL
    `).catch(() => {});

    // Add is_active flag to users (for enable/disable)
    await getPool().query(`ALTER TABLE users ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1`).catch(() => {});

    // Add trainer_id to batches if missing (for older schemas)
    await getPool().query(`
      ALTER TABLE batches ADD COLUMN IF NOT EXISTS trainer_id INT,
        ADD COLUMN IF NOT EXISTS trainer_name VARCHAR(255)
    `).catch(() => {});

    // Add started_at / ended_at to live_classes if missing
    await getPool().query(`
      ALTER TABLE live_classes
        ADD COLUMN IF NOT EXISTS started_at TIMESTAMP NULL,
        ADD COLUMN IF NOT EXISTS ended_at TIMESTAMP NULL
    `).catch(() => {});

    // Faculty assignment + approval workflow (separate statements for compatibility)
    await getPool().query(`ALTER TABLE live_classes ADD COLUMN faculty_id INT DEFAULT NULL`).catch(() => {});
    await getPool().query(`ALTER TABLE live_classes ADD COLUMN approved_by INT DEFAULT NULL`).catch(() => {});

    // Extend status enum to include pending_approval
    await getPool().query(`
      ALTER TABLE live_classes MODIFY COLUMN status
        ENUM('pending_approval','scheduled','live','ended','cancelled','recorded') DEFAULT 'scheduled'
    `).catch(() => {});

    // Class-access coupons (admin gives to partner, partner distributes to students)
    await getPool().query(`
      CREATE TABLE IF NOT EXISTS class_access_coupons (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(50) NOT NULL UNIQUE,
        agency_id INT,
        description VARCHAR(255),
        access_type ENUM('class_count','hour_count','unlimited') DEFAULT 'class_count',
        allowed_count INT DEFAULT 5,
        max_redemptions INT DEFAULT 100,
        used_count INT DEFAULT 0,
        expires_at DATE,
        is_active TINYINT(1) DEFAULT 1,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(() => {});

    await getPool().query(`
      CREATE TABLE IF NOT EXISTS coupon_redemptions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        coupon_id INT NOT NULL,
        student_id INT NOT NULL,
        classes_used INT DEFAULT 0,
        minutes_used INT DEFAULT 0,
        redeemed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_coupon_student (coupon_id, student_id),
        FOREIGN KEY (coupon_id) REFERENCES class_access_coupons(id)
      )
    `).catch(() => {});

    // Logo URL for agencies
    await getPool().query(`ALTER TABLE agencies ADD COLUMN logo_url TEXT`).catch(() => {});
    // Widen logo_url to MEDIUMTEXT (base64 images exceed TEXT 64KB limit)
    await getPool().query(`ALTER TABLE agencies MODIFY COLUMN logo_url MEDIUMTEXT`).catch(() => {});

    // Payment config per agency (UPI, QR, link, mobile)
    await getPool().query(`
      CREATE TABLE IF NOT EXISTS agency_payment_config (
        id INT AUTO_INCREMENT PRIMARY KEY,
        agency_id INT NOT NULL UNIQUE,
        upi_id VARCHAR(100),
        upi_name VARCHAR(100),
        qr_code_image MEDIUMTEXT,
        payment_link TEXT,
        mobile_number VARCHAR(20),
        mobile_instructions TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (agency_id) REFERENCES agencies(id)
      )
    `).catch(() => {});

    // Widen qr_code_image if created as TEXT (older migration)
    await getPool().query(`ALTER TABLE agency_payment_config MODIFY COLUMN qr_code_image MEDIUMTEXT`).catch(() => {});

    // Payment proofs submitted by students
    await getPool().query(`
      CREATE TABLE IF NOT EXISTS payment_proofs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        enrollment_id INT NOT NULL,
        student_id INT NOT NULL,
        agency_id INT NOT NULL,
        amount DECIMAL(10,2),
        payment_method ENUM('upi','qr','link','mobile','other') DEFAULT 'other',
        proof_image MEDIUMTEXT,
        notes TEXT,
        status ENUM('pending','verified','rejected') DEFAULT 'pending',
        admin_note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `).catch(() => {});

    // Agency profile edit tracking
    await getPool().query(`ALTER TABLE agencies ADD COLUMN partner_edit_count INT DEFAULT 0`).catch(() => {});
    // Partner payment permission
    await getPool().query(`ALTER TABLE agencies ADD COLUMN can_configure_payment TINYINT(1) DEFAULT 0`).catch(() => {});
    // Global admin payment config (single row, id always 1)
    await getPool().query(`
      CREATE TABLE IF NOT EXISTS global_payment_config (
        id INT DEFAULT 1 PRIMARY KEY,
        upi_id VARCHAR(100), upi_name VARCHAR(100),
        qr_code_image MEDIUMTEXT, payment_link TEXT,
        mobile_number VARCHAR(20), mobile_instructions TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `).catch(() => {});
    // Payment proof: track verified_by
    await getPool().query(`ALTER TABLE payment_proofs ADD COLUMN verified_by_user_id INT`).catch(() => {});
    await getPool().query(`ALTER TABLE payment_proofs ADD COLUMN verified_at TIMESTAMP`).catch(() => {});
    // Partner portal customization
    await getPool().query(`ALTER TABLE agencies ADD COLUMN visible_sections TEXT`).catch(() => {});
    await getPool().query(`ALTER TABLE agencies ADD COLUMN layout_type INT DEFAULT 1`).catch(() => {});
    await getPool().query(`
      CREATE TABLE IF NOT EXISTS agency_edit_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        agency_id INT NOT NULL,
        changed_by_user_id INT NOT NULL,
        changed_by_name VARCHAR(200),
        changed_by_role VARCHAR(50),
        changes_json TEXT,
        changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (agency_id) REFERENCES agencies(id)
      )
    `).catch(() => {});

    console.log('✅ Migrations applied');
  } catch (e) {
    console.log('⚠️  Migration warning:', e.message);
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
