# Deploy TestPrep Platform to Free Tier

## Option 1: Railway (Recommended - Always On)

### 1. Backend + Database
```bash
cd server

# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Create project
railway init

# Add MySQL (this creates the database automatically)
railway add --database mysql

# Set environment variables
railway variables set JWT_SECRET=your_super_secret_key
railway variables set LMS_BASE_URL=https://your-lms-domain.com
railway variables set LMS_SSO_SECRET=your_sso_secret

# Deploy
railway up

# Get domain
railway domain
```

### 2. Frontend (Vercel)
```bash
cd client

# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod

# Set API URL (replace with your Railway domain)
vercel env add VITE_API_URL https://your-railway-app.up.railway.app
```

## Option 2: Render + PlanetScale (100% Free)

### 1. Database (PlanetScale)
1. Go to https://planetscale.com
2. Create free account
3. Create database `testprep_platform`
4. Get connection string
5. Run schema files

### 2. Backend (Render)
1. Go to https://render.com
2. Create Web Service
3. Connect GitHub repo
4. Set build command: `cd server && npm install`
5. Set start command: `node index.js`
6. Add environment variables

### 3. Frontend (Netlify)
1. Go to https://netlify.com
2. Drag & drop `client/dist` folder
3. Or connect GitHub for auto-deploy

## Environment Variables

### Backend (.env)
```
PORT=4002
DB_HOST=mysql.railway.internal  # or your MySQL host
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=testprep_platform
JWT_SECRET=your_jwt_secret_here
LMS_BASE_URL=https://testprepgpt.ai
LMS_SSO_SECRET=your_sso_secret
```

### Frontend (.env.local)
```
VITE_API_URL=https://your-backend-domain.com
```

## Post-Deployment

1. **Run migrations** on Railway:
```bash
railway run node create_tables.js
```

2. **Seed initial data**:
```bash
railway mysql < database/schema.sql
```

3. **Test login**:
- URL: https://your-vercel-domain.vercel.app
- Email: admin@testprep.com
- Password: admin123

## Features Available After Deploy

✅ Live Class Scheduling
✅ Jitsi Video Integration  
✅ Batch Management
✅ Student Enrollment
✅ Attendance Tracking
✅ Progress Tracking
✅ Demo Access System

## Cost Estimate (Railway)

- Node.js backend: ~$2-3/month
- MySQL database: ~$1-2/month
- **Total: Within $5 free credit**

If traffic grows, upgrade to paid plan (~$5/month total).
