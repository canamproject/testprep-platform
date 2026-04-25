# GitHub + Railway + Vercel Auto-Deployment Setup

## Overview
This setup enables automatic deployment:
- **Push to GitHub** → Auto-deploy backend to Railway
- **Push to GitHub** → Auto-deploy frontend to Vercel

## Step 1: Create GitHub Repository

```bash
cd "d:\Devloment\White label\testprep-platform_1"

# Initialize git repo
git init

# Add all files
git add .

# Initial commit
git commit -m "Initial commit with Live Classes feature"

# Create GitHub repo (via browser or CLI)
# Then push:
git remote add origin https://github.com/YOUR_USERNAME/testprep-platform.git
git push -u origin main
```

## Step 2: Setup Railway (Backend + Database)

### 2.1 Install Railway CLI locally
```bash
npm i -g @railway/cli
railway login
```

### 2.2 Create Railway Project
```bash
cd server
railway init --name testprep-backend
railway add --database mysql
```

### 2.3 Set Environment Variables
```bash
railway variables set JWT_SECRET=your_super_secret_key_here
railway variables set LMS_BASE_URL=https://your-lms-domain.com
railway variables set LMS_SSO_SECRET=your_sso_secret
railway variables set PORT=4002
```

### 2.4 Deploy Backend
```bash
railway up
railway domain  # Get your backend URL
```

### 2.5 Get Railway Token for GitHub
```bash
railway token
```
Copy this token - you'll add it to GitHub secrets.

## Step 3: Setup Vercel (Frontend)

### 3.1 Install Vercel CLI
```bash
npm i -g vercel
vercel login
```

### 3.2 Update API URL
Edit `client/vercel.json`:
```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://YOUR_RAILWAY_BACKEND.up.railway.app/api/:path*"
    }
  ]
}
```

### 3.3 Deploy Frontend
```bash
cd client
vercel --prod
```

### 3.4 Get Vercel Token
Go to https://vercel.com/account/tokens
Create new token → Copy it

## Step 4: Configure GitHub Secrets

Go to your GitHub repo → Settings → Secrets and variables → Actions

Add these secrets:

| Secret Name | Value |
|-------------|-------|
| `RAILWAY_TOKEN` | Your Railway token from Step 2.5 |
| `VERCEL_TOKEN` | Your Vercel token from Step 3.4 |

## Step 5: Test Auto-Deployment

1. Make a small change to `server/index.js`
2. Commit and push:
```bash
git add .
git commit -m "Test auto-deployment"
git push origin main
```
3. Watch GitHub Actions tab - deployment should start automatically!

## Step 6: Run Database Migrations (One-time)

After backend is deployed, run migrations:

### Option A: Railway Dashboard
1. Go to https://railway.app/dashboard
2. Click your project
3. Click "MySQL" service
4. Go to "Data" tab
5. Click "Query" and paste contents of `database/schema.sql`

### Option B: Railway CLI
```bash
cd server
railway mysql < ../database/schema.sql
railway run node create_tables.js
```

## Step 7: Verify Deployment

### Test Backend Health
```bash
curl https://YOUR_RAILWAY_BACKEND.up.railway.app/api/health
```

### Test Frontend
Open: `https://YOUR_VERCEL_DOMAIN.vercel.app`

### Test Login
- **Admin:** admin@testprep.com / admin123
- **Partner:** partner@brightpath.com / partner123
- **Student:** student@example.com / student123

## Project Structure

```
testprep-platform/
├── .github/
│   └── workflows/
│       ├── deploy-backend.yml    # Auto-deploy to Railway
│       └── deploy-frontend.yml   # Auto-deploy to Vercel
├── client/                       # React + Vite frontend
│   ├── src/
│   ├── vercel.json             # Vercel config
│   └── package.json
├── server/                       # Express + MySQL backend
│   ├── index.js
│   ├── railway.toml            # Railway config
│   └── package.json
├── database/
│   ├── schema.sql               # Base schema
│   └── live_classes_migration.sql # Live classes tables
├── .gitignore
├── DEPLOY.md
└── GITHUB_SETUP.md             # This file
```

## Troubleshooting

### GitHub Actions Failing?
1. Check secrets are set correctly
2. Check workflow logs in GitHub Actions tab
3. Ensure Railway and Vercel tokens are valid

### Database Connection Issues?
1. Check Railway MySQL is running
2. Verify environment variables in Railway dashboard
3. Check MySQL connection string

### API 404 Errors?
1. Ensure backend health check works
2. Check Vercel rewrite rules point to correct Railway URL
3. Verify CORS settings in backend

## Useful Commands

```bash
# Check Railway logs
railway logs

# Restart Railway service
railway restart

# Open Railway dashboard
railway open

# Check Vercel deployments
vercel list
```

## Cost

- **Railway:** $5/month free credit (covers Node.js + MySQL)
- **Vercel:** Free unlimited for frontend
- **GitHub:** Free for public repos
- **Total:** $0 for small-medium usage

## Support

- Railway docs: https://docs.railway.app
- Vercel docs: https://vercel.com/docs
- GitHub Actions: https://docs.github.com/actions
