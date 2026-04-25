# TestPrep White-Label Platform — Local Setup Guide
## Stack: Node.js + Express + MySQL + React + Vite

---

## FOLDER STRUCTURE

```
testprep-platform/
├── database/
│   └── schema.sql          ← Run this in MySQL first
├── server/                 ← Express API (port 4000)
│   ├── index.js
│   ├── package.json
│   └── .env                ← Edit with your MySQL credentials
└── client/                 ← React frontend (port 5173)
    ├── src/
    │   ├── App.jsx
    │   ├── pages/
    │   │   ├── Login.jsx
    │   │   ├── admin/AdminDashboard.jsx
    │   │   ├── partner/PartnerDashboard.jsx
    │   │   └── student/StudentDashboard.jsx
    │   ├── contexts/AuthContext.jsx
    │   ├── components/DashLayout.jsx
    │   └── lib/api.js
    ├── vite.config.js
    └── package.json
```

---

## PREREQUISITES

- Node.js 18+ installed
- MySQL 8.0+ installed and running
- Windsurf or VS Code editor

---

## STEP 1 — MySQL Setup

Open MySQL and run:

```sql
mysql -u root -p < database/schema.sql
```

Or open MySQL Workbench / phpMyAdmin and paste the full schema.sql content.

This creates the database `testprep_platform` with:
- 3 agencies (BrightPath, GlobalVisa, EduStar)
- 25 students (distributed across agencies)
- 25 enrollments (varied courses per agency)
- 10 courses (IELTS, PTE, TOEFL, German, French, Spoken English, Combo)
- 7 coupons
- 4 payout records
- 10 CRM leads

---

## STEP 2 — Server Setup

```bash
cd server
npm install
```

Edit `.env` file with your MySQL password:

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=YOUR_MYSQL_PASSWORD_HERE
DB_NAME=testprep_platform
JWT_SECRET=testprep_super_secret_key_change_in_production
LMS_BASE_URL=https://testprepgpt.ai
LMS_SSO_SECRET=lms_sso_secret_key
PORT=4000
```

Start server:

```bash
npm run dev
# or: node index.js
```

Test: Open http://localhost:4000/api/health — should return `{"status":"ok","db":"connected"}`

---

## STEP 3 — Client Setup

Open a NEW terminal:

```bash
cd client
npm install
npm run dev
```

Open: http://localhost:5173

---

## STEP 4 — Login Credentials

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@testprep.com | Admin@123 |
| BrightPath Admin | admin@brightpath.in | Partner@123 |
| GlobalVisa Admin | ops@globalvisa.com | Partner@123 |
| EduStar Admin | info@edustar.co | Partner@123 |
| Student (any) | priya.sharma@email.com | Student@123 |
| Student (any) | kabir.nair@email.com | Student@123 |
| Student (any) | tanvi.more@email.com | Student@123 |

> **Quick demo:** The login page has quick-fill buttons for all roles.

---

## TENANT PORTAL URLS

Each agency has its own branded portal:

| Agency | URL | Color |
|--------|-----|-------|
| BrightPath Academy | http://localhost:5173/agent/brightpath | Blue |
| GlobalVisa Consultants | http://localhost:5173/agent/globalvisa | Teal |
| EduStar Institute | http://localhost:5173/agent/edustar | Purple |

When you visit `/agent/brightpath`, you see BrightPath's branded login page.
Students see only that agency's branding — no TestPrepGPT.ai branding anywhere.

---

## WHAT EACH PORTAL CAN DO

### Admin Panel (admin@testprep.com)
- View all 3 agencies with revenue + student counts
- Create new agencies
- See all 25 students across agencies
- View all 25 enrollments
- Revenue analytics with per-agency breakdown
- Approve/reject/mark-paid commission payouts
- View all coupons
- Manage courses
- LMS Bridge — see all student → LMS ID mappings

### Partner Panel (per agency)
- Dashboard with earnings overview
- Register new students (gets LMS ID automatically)
- Enroll students in courses with coupon support
- Mark payments as paid
- Earnings breakdown (60/65/55% commission)
- One-click commission claim request
- CRM Kanban board (New → Contacted → Demo → Enrolled)
- Create agency-specific coupon codes
- Branding page showing tenant config

### Student Portal (branded per agency)
- Sees only their agency's brand colors + logo
- Course cards with progress bars
- "Start Learning" button generates SSO token (LMS URL hidden)
- Payment history
- Profile page

---

## COURSES IN THE SYSTEM

| Course | Category | Price |
|--------|----------|-------|
| IELTS Academic Masterclass | IELTS | ₹14,999 |
| IELTS General Training | IELTS | ₹12,999 |
| PTE Academic Core | PTE | ₹9,999 |
| PTE Score Booster (7-Day) | PTE | ₹4,999 |
| TOEFL Comprehensive Prep | TOEFL | ₹12,499 |
| German A1 Intensive | GERMAN | ₹18,999 |
| German A2 Intermediate | GERMAN | ₹21,999 |
| Spoken English Mastery | SPOKEN_ENGLISH | ₹7,999 |
| French A1 Beginner | FRENCH | ₹15,999 |
| IELTS + PTE Combo Pack | IELTS | ₹19,999 |

---

## DUMMY DATA SUMMARY

| Agency | Students | Revenue | Commission |
|--------|----------|---------|------------|
| BrightPath Academy | 12 | ~₹1.75L | 60% |
| GlobalVisa Consultants | 8 | ~₹1.24L | 65% |
| EduStar Institute | 5 | ~₹0.45L | 55% |

---

## ARCHITECTURE NOTES

- **LMS is completely hidden** — the LMS domain is only in `.env` on the server
- **SSO tokens** are generated server-side and never expose LMS URL to the client
- **Tenant isolation** — partners only see their own students/enrollments (enforced in SQL WHERE clauses)
- **RBAC** — JWT tokens contain role; every route checks role before responding
- **Subpath routing** — `/agent/:slug` identifies the tenant and loads their branding
- **Commission** — configurable per agency (default 60% partner / 40% platform)

---

## TROUBLESHOOTING

**"Can't connect to DB"** → Check MySQL is running and `.env` password is correct

**"Port already in use"** → Change PORT in `.env` or kill the process using that port

**CORS error** → Make sure client is on port 5173 and server on 4000

**Login fails** → Run the schema.sql again to re-seed users with correct password hashes
