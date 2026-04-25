# PowerShell Setup Script for GitHub + Railway + Vercel Deployment
# Run this in PowerShell as Administrator

Write-Host "🚀 TestPrep Platform Deployment Setup" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host ""

# Check if Git is installed
$gitInstalled = Get-Command git -ErrorAction SilentlyContinue
if (-not $gitInstalled) {
    Write-Host "❌ Git is not installed. Please install Git first:" -ForegroundColor Red
    Write-Host "   https://git-scm.com/download/win" -ForegroundColor Yellow
    exit 1
}

# Check if Node.js is installed
$nodeInstalled = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeInstalled) {
    Write-Host "❌ Node.js is not installed. Please install Node.js first:" -ForegroundColor Red
    Write-Host "   https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Git and Node.js are installed" -ForegroundColor Green
Write-Host ""

# Get GitHub username
$githubUsername = Read-Host "Enter your GitHub username"
$repoName = Read-Host "Enter repository name (default: testprep-platform)"
if (-not $repoName) { $repoName = "testprep-platform" }

Write-Host ""
Write-Host "Step 1: Setting up Git repository..." -ForegroundColor Cyan

# Initialize git if not already done
if (-not (Test-Path .git)) {
    git init
    Write-Host "✅ Git repository initialized" -ForegroundColor Green
} else {
    Write-Host "ℹ️ Git repository already exists" -ForegroundColor Yellow
}

# Configure git user if not set
$gitUserName = git config user.name
$gitUserEmail = git config user.email

if (-not $gitUserName) {
    $gitName = Read-Host "Enter your name for Git config"
    git config user.name "$gitName"
}
if (-not $gitUserEmail) {
    $gitEmail = Read-Host "Enter your email for Git config"
    git config user.email "$gitEmail"
}

Write-Host ""
Write-Host "Step 2: Adding files to Git..." -ForegroundColor Cyan
git add .

$commitMsg = Read-Host "Enter commit message (default: Initial commit with Live Classes feature)"
if (-not $commitMsg) { $commitMsg = "Initial commit with Live Classes feature" }

git commit -m "$commitMsg"
Write-Host "✅ Files committed" -ForegroundColor Green

Write-Host ""
Write-Host "Step 3: Creating GitHub repository..." -ForegroundColor Cyan
Write-Host "   Opening browser to create GitHub repo..." -ForegroundColor Yellow
Start-Process "https://github.com/new?name=$repoName&description=TestPrep%20Platform%20with%20Live%20Classes"

Read-Host "Press Enter after creating the GitHub repo..."

git remote add origin "https://github.com/$githubUsername/$repoName.git" 2>$null
git branch -M main
git push -u origin main

Write-Host "✅ Code pushed to GitHub" -ForegroundColor Green

Write-Host ""
Write-Host "Step 4: Installing Railway CLI..." -ForegroundColor Cyan
npm i -g @railway/cli

Write-Host ""
Write-Host "Step 5: Setting up Railway (Backend)..." -ForegroundColor Cyan
Write-Host "   Please login to Railway:" -ForegroundColor Yellow
railway login

cd server
railway init --name "$repoName-backend"
railway add --database mysql

Write-Host ""
Write-Host "   Setting environment variables..." -ForegroundColor Yellow
$jwtSecret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object { [char]$_ })
railway variables set JWT_SECRET="$jwtSecret"
railway variables set LMS_BASE_URL="https://testprepgpt.ai"
railway variables set LMS_SSO_SECRET="change_in_production"
railway variables set PORT="4002"

railway up
$railwayDomain = railway domain 2>$null

Write-Host "✅ Backend deployed to Railway!" -ForegroundColor Green
Write-Host "   URL: $railwayDomain" -ForegroundColor Cyan

cd ..

Write-Host ""
Write-Host "Step 6: Installing Vercel CLI..." -ForegroundColor Cyan
npm i -g vercel

Write-Host ""
Write-Host "Step 7: Setting up Vercel (Frontend)..." -ForegroundColor Cyan

# Update vercel.json with Railway domain
$vercelConfig = Get-Content client/vercel.json -Raw
$vercelConfig = $vercelConfig -replace "https://your-railway-backend.up.railway.app", $railwayDomain
Set-Content client/vercel.json $vercelConfig

cd client
vercel --prod

cd ..

Write-Host ""
Write-Host "Step 8: Getting deployment tokens..." -ForegroundColor Cyan
Write-Host "   Getting Railway token..." -ForegroundColor Yellow
$railwayToken = railway token
Write-Host "   Railway Token: $railwayToken" -ForegroundColor Magenta

Write-Host ""
Write-Host "   Please create Vercel token:" -ForegroundColor Yellow
Write-Host "   1. Go to https://vercel.com/account/tokens" -ForegroundColor Cyan
Write-Host "   2. Create new token" -ForegroundColor Cyan
Write-Host "   3. Copy the token" -ForegroundColor Cyan
$vercelToken = Read-Host "Enter Vercel token"

Write-Host ""
Write-Host "Step 9: Configure GitHub Secrets..." -ForegroundColor Cyan
Write-Host "   Opening GitHub repo settings..." -ForegroundColor Yellow
Start-Process "https://github.com/$githubUsername/$repoName/settings/secrets/actions"

Write-Host ""
Write-Host "   Add these secrets in GitHub:" -ForegroundColor Yellow
Write-Host "   Name: RAILWAY_TOKEN" -ForegroundColor Cyan
Write-Host "   Value: $railwayToken" -ForegroundColor Magenta
Write-Host ""
Write-Host "   Name: VERCEL_TOKEN" -ForegroundColor Cyan  
Write-Host "   Value: $vercelToken" -ForegroundColor Magenta

Read-Host "Press Enter after adding secrets to GitHub..."

Write-Host ""
Write-Host "Step 10: Running database migrations..." -ForegroundColor Cyan
cd server
railway mysql < ../database/schema.sql
railway run node create_remaining_tables.js

cd ..

Write-Host ""
Write-Host "=====================================" -ForegroundColor Green
Write-Host "🎉 Setup Complete!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host ""
Write-Host "Your app is now deployed!" -ForegroundColor Cyan
Write-Host "Frontend: (check Vercel dashboard)" -ForegroundColor White
Write-Host "Backend: $railwayDomain" -ForegroundColor White
Write-Host ""
Write-Host "Test Login:" -ForegroundColor Yellow
Write-Host "  Admin: admin@testprep.com / admin123" -ForegroundColor White
Write-Host "  Partner: partner@brightpath.com / partner123" -ForegroundColor White
Write-Host "  Student: student@example.com / student123" -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Push any change to GitHub to trigger auto-deployment" -ForegroundColor White
Write-Host "2. Check GitHub Actions tab for deployment status" -ForegroundColor White
Write-Host "3. Monitor Railway dashboard for backend logs" -ForegroundColor White
