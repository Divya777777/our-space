# Railway Deployment Guide for Our Space Backend

This guide will walk you through deploying your Our Space backend to Railway.app.

## Prerequisites

- GitHub account with access to your repository
- Railway.app account (sign up at https://railway.app)
- Your Google OAuth credentials

## Step 1: Prepare Backend for Deployment

✅ **Already Done!** The following files have been created:
- `backend/railway.json` - Railway configuration
- `backend/nixpacks.toml` - Build configuration
- `backend/.railwayignore` - Files to exclude from deployment
- `backend/.env.production.example` - Production environment template
- `backend/prisma/schema.prisma` - Updated to use PostgreSQL

## Step 2: Generate Production Secrets

Run these commands to generate secure secrets:

```bash
# Generate JWT Secret (64 characters)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Generate JWT Refresh Secret (64 characters)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Generate Session Secret (64 characters)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Generate Encryption Key (32 bytes = 64 hex characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Save these values** - you'll need them in Step 5!

## Step 3: Commit Backend Files to Git

```bash
cd /home/divya/our_space/our-space

# Add the new files
git add backend/railway.json
git add backend/nixpacks.toml
git add backend/.railwayignore
git add backend/.env.production.example
git add backend/prisma/schema.prisma

# Commit the changes
git commit -m "Add Railway deployment configuration

- Add Railway and Nixpacks configuration files
- Update Prisma schema to use PostgreSQL
- Add production environment template"

# Push to GitHub
git push origin stg
```

## Step 4: Create Railway Project

1. Go to https://railway.app
2. Click **"Start a New Project"**
3. Select **"Deploy from GitHub repo"**
4. Authorize Railway to access your GitHub account
5. Select your `our-space` repository
6. Railway will detect your backend automatically

## Step 5: Add PostgreSQL Database

1. In your Railway project, click **"+ New"**
2. Select **"Database"** → **"PostgreSQL"**
3. Railway will automatically create a PostgreSQL database
4. The `DATABASE_URL` environment variable will be set automatically

## Step 6: Configure Environment Variables

1. Click on your backend service in Railway
2. Go to the **"Variables"** tab
3. Add these environment variables (click "+ New Variable"):

```
NODE_ENV=production
JWT_SECRET=<paste the JWT secret you generated in Step 2>
JWT_REFRESH_SECRET=<paste the JWT refresh secret you generated in Step 2>
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d
SESSION_SECRET=<paste the session secret you generated in Step 2>
ENCRYPTION_KEY=<paste the encryption key you generated in Step 2>
GOOGLE_CLIENT_ID=<your Google OAuth client ID>
GOOGLE_CLIENT_SECRET=<your Google OAuth client secret>
CORS_ORIGIN=https://divya777777.github.io
PEERJS_PATH=/peerjs
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
LOG_LEVEL=info
```

**Important Notes:**
- `PORT` and `DATABASE_URL` are automatically set by Railway
- Use your **existing Google OAuth credentials**
- The `CORS_ORIGIN` allows your GitHub Pages frontend to connect

## Step 7: Update Google OAuth Redirect URIs

1. Go to https://console.cloud.google.com/apis/credentials
2. Select your OAuth 2.0 Client ID
3. Under **"Authorized JavaScript origins"**, add:
   ```
   https://<your-railway-app>.up.railway.app
   ```
4. Under **"Authorized redirect URIs"**, add:
   ```
   https://divya777777.github.io/our-space/
   ```
5. Click **"Save"**

## Step 8: Deploy Backend

1. Railway will automatically deploy after you set environment variables
2. Wait for deployment to complete (check the **"Deployments"** tab)
3. Look for "Build successful" and "Deployment successful" messages

## Step 9: Get Your Backend URL

1. In Railway, click on your backend service
2. Go to the **"Settings"** tab
3. Under **"Domains"**, click **"Generate Domain"**
4. Railway will give you a URL like: `https://our-space-backend-production.up.railway.app`
5. **Copy this URL** - you'll need it for the frontend!

## Step 10: Test Backend Health

Open your browser and visit:
```
https://<your-railway-url>.up.railway.app/health
```

You should see:
```json
{
  "status": "healthy",
  "timestamp": "...",
  "database": "connected",
  "peerjs": "running"
}
```

## Step 11: Update Frontend Configuration

1. Open `/home/divya/our_space/our-space/api.js`
2. Update line 10 with your actual Railway URL:

```javascript
if (hostname === 'divya777777.github.io') {
  this.baseURL = 'https://<your-actual-railway-url>.up.railway.app/api';
}
```

3. Open `/home/divya/our_space/our-space/room.js`
4. Update line 735 with your actual Railway URL:

```javascript
if (window.location.hostname === 'divya777777.github.io') {
  peerConfig.host = '<your-actual-railway-url>.up.railway.app';
```

5. Commit and push these changes:

```bash
git add api.js room.js
git commit -m "Update frontend to use Railway backend URL"
git push origin stg
```

## Step 12: Create Staging Frontend Repository

1. Go to GitHub: https://github.com/divya777777
2. Click **"New repository"**
3. Name it: `our-space-stg`
4. Make it **Public**
5. Do NOT initialize with README
6. Click **"Create repository"**

## Step 13: Deploy Staging Frontend

```bash
cd /home/divya/our_space/our-space

# Add the new remote
git remote add staging https://github.com/divya777777/our-space-stg.git

# Push stg branch to staging repo
git push staging stg:main

# Enable GitHub Pages
# Go to: https://github.com/divya777777/our-space-stg/settings/pages
# Under "Source", select "Deploy from a branch"
# Select branch: "main" and folder: "/ (root)"
# Click "Save"
```

Your staging frontend will be available at:
```
https://divya777777.github.io/our-space-stg/
```

## Troubleshooting

### Database Migration Errors
If you see Prisma migration errors:
1. Go to Railway → Your Backend Service → "Deployments"
2. Check the build logs
3. If migrations fail, manually run them:
   - Click "..." → "Run Command"
   - Enter: `npx prisma migrate deploy`

### CORS Errors
If you get CORS errors in browser console:
1. Check Railway environment variables
2. Ensure `CORS_ORIGIN` includes your GitHub Pages URL
3. Redeploy by going to "Deployments" → Click "..." → "Redeploy"

### PeerJS Connection Issues
If video/audio doesn't connect:
1. Check browser console for PeerJS errors
2. Verify `PEERJS_PATH=/peerjs` is set in Railway
3. Test PeerJS endpoint: `https://<your-railway-url>/peerjs/peerjs/id`

### Environment Variable Changes
After changing environment variables:
1. Railway automatically redeploys
2. Wait 2-3 minutes for deployment
3. Clear browser cache and test again

## Cost and Usage

**Railway Free Tier:**
- $5 credit per month
- Enough for small projects
- ~500 hours of uptime

**When you need to upgrade:**
- Free credit runs out
- Need more than 500 hours/month
- Next tier: ~$5-10/month depending on usage

## Backup Strategy (Recommended)

Set up automatic daily database backups:

1. Go to Railway → PostgreSQL Database → "Settings"
2. Enable "Backups" (may require paid plan)
3. Or use this backup script (run weekly on your local machine):

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link to your project
railway link

# Export database
railway run pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql
```

## Next Steps

After successful deployment:

1. ✅ Test sign-in with Google OAuth
2. ✅ Create a test room
3. ✅ Test playlists and songs
4. ✅ Test video/audio calls
5. ✅ Share staging URL with friends for testing

## Support

If you encounter issues:
- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Check Railway logs in "Deployments" tab
