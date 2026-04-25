# 🚀 Quick Start - Deploy in 10 Minutes

## Prerequisites
- GitHub account
- Railway account (free tier)
- Vercel account (free tier)

## Step 1: Push to GitHub (2 min)

```bash
# Open PowerShell in project folder
cd "d:\Devloment\White label\testprep-platform_1"

# Initialize git
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit with Live Classes"

# Create repo on GitHub (via browser), then push
git remote add origin https://github.com/YOUR_USERNAME/testprep-platform.git
git push -u origin main
```

## Step 2: Deploy Backend to Railway (4 min)

1. Go to https://railway.app
2. Login with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your `testprep-platform` repo
5. Railway auto-detects Node.js

### Add MySQL Database:
1. In Railway dashboard, click "New" → "Database" → "Add MySQL"
2. MySQL is automatically connected to your app

### Set Environment Variables:
In Railway dashboard → Variables tab:
```
JWT_SECRET=your_random_secret_string_here
LMS_BASE_URL=https://testprepgpt.ai
LMS_SSO_SECRET=your_lms_secret
PORT=4002
```

### Deploy:
Railway auto-deploys on every GitHub push!

Get your backend URL from Railway dashboard (e.g., `https://testprep-backend.up.railway.app`)

## Step 3: Deploy Frontend to Vercel (3 min)

### Update API URL:
Edit `client/vercel.json`:
```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://YOUR_RAILWAY_URL.up.railway.app/api/:path*"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### Deploy:
1. Go to https://vercel.com
2. Login with GitHub
3. Click "Add New Project"
4. Import your GitHub repo
5. Set framework preset to "Vite"
6. Root directory: `client`
7. Deploy!

## Step 4: Run Database Migrations (1 min)

### In Railway Dashboard:
1. Click on your MySQL service
2. Go to "Data" tab
3. Click "Query"
4. Paste and run `database/schema.sql`
5. Then run `database/live_classes_migration.sql`

Or use Railway CLI:
```bash
cd server
railway login
railway mysql < ../database/schema.sql
railway run node create_remaining_tables.js
```

## Step 5: Test Your Live App! 🎉

**Frontend URL:** https://your-app.vercel.app

**Test Login:**
- **Admin:** `admin@testprep.com` / `admin123`
- **Partner:** `partner@brightpath.com` / `partner123`
- **Student:** `student@example.com` / `student123`

## Features Ready to Test:

✅ **Admin Dashboard** → Batches & Live Classes tabs
✅ **Partner Dashboard** → Batches & Live Classes tabs  
✅ **Student Dashboard** → Live Classes tab
✅ **Jitsi Video Rooms** → Click "Join Class"
✅ **Batch Management** → Create cohorts
✅ **Class Scheduling** → Schedule live sessions
✅ **Attendance Tracking** → Auto-track participation

## Auto-Deployment Enabled!

From now on, every push to GitHub main branch:
- Auto-deploys backend to Railway
- Auto-deploys frontend to Vercel

No manual steps needed!

## Cost: $0

- **Railway:** $5/month free credit covers Node.js + MySQL
- **Vercel:** Unlimited free frontend hosting
- **GitHub:** Free public repos

## Troubleshooting

### Railway backend shows 404?
- Check health endpoint: `https://your-url.up.railway.app/api/health`
- Check Railway logs in dashboard

### Frontend can't connect to backend?
- Verify `vercel.json` has correct Railway URL
- Check CORS settings in backend

### Database errors?
- Ensure migrations ran successfully
- Check Railway MySQL connection string

## Next Steps

1. **Create your first batch** in Admin dashboard
2. **Schedule a live class** in Live Classes tab
3. **Join the class** to test Jitsi video room
4. **Share with team** for testing!

## Links

- **Railway Dashboard:** https://railway.app/dashboard
- **Vercel Dashboard:** https://vercel.com/dashboard
- **GitHub Repo:** https://github.com/YOUR_USERNAME/testprep-platform

---

**Need help?** Check `GITHUB_SETUP.md` for detailed instructions.
