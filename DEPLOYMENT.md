# IdiamPro Deployment Guide

## Deploying to Vercel (Recommended)

### Prerequisites
1. A GitHub account
2. A Vercel account (free tier available at https://vercel.com)
3. Your Gemini API key

### Step 1: Push to GitHub

1. **Create a new repository on GitHub:**
   - Go to https://github.com/new
   - Name it "IdiamPro" (or your preferred name)
   - Make it Private (recommended)
   - Don't initialize with README
   - Click "Create repository"

2. **Push your code to GitHub:**
   ```bash
   cd "/Users/howardjachter/Library/Mobile Documents/com~apple~CloudDocs/ClaudeProjects/IdiamPro"
   git remote add origin https://github.com/YOUR_USERNAME/IdiamPro.git
   git branch -M main
   git push -u origin main
   ```

### Step 2: Deploy to Vercel

1. **Go to Vercel:**
   - Visit https://vercel.com
   - Click "Sign Up" or "Login"
   - Choose "Continue with GitHub"

2. **Import your repository:**
   - Click "Add New" → "Project"
   - Find "IdiamPro" in your repositories
   - Click "Import"

3. **Configure the project:**
   - Framework Preset: **Next.js** (auto-detected)
   - Root Directory: `./` (default)
   - Click "Deploy" (don't worry about env vars yet)

4. **Add Environment Variables:**
   - After first deployment, go to your project settings
   - Click "Environment Variables"
   - Add:
     - Name: `GEMINI_API_KEY`
     - Value: Your Gemini API key (from .env.local)
     - Select all environments (Production, Preview, Development)
   - Click "Save"

5. **Redeploy:**
   - Go to "Deployments" tab
   - Click the three dots on the latest deployment
   - Click "Redeploy"

### Step 3: Access Your App

Your app will be live at:
- **Production:** `https://your-project-name.vercel.app`
- **Custom Domain:** You can add your own domain in settings

### Automatic Deployments

Once set up, Vercel will automatically:
- Deploy every push to `main` branch to production
- Create preview deployments for pull requests
- Provide deployment URLs for each commit

### Monitoring

- **Analytics:** Vercel → Your Project → Analytics
- **Logs:** Vercel → Your Project → Logs
- **Budget Alerts:** Set up in Google Cloud Console (for Gemini API usage)

## Alternative: Firebase Hosting

If you prefer Firebase:

1. **Install Firebase CLI:**
   ```bash
   npm install -g firebase-tools
   ```

2. **Initialize Firebase:**
   ```bash
   firebase login
   firebase init hosting
   ```

3. **Build and deploy:**
   ```bash
   npm run build
   firebase deploy
   ```

## Environment Variables Reference

Required for production:
- `GEMINI_API_KEY` - Your Google Gemini API key

## Troubleshooting

**Build fails:**
- Check that all dependencies are in package.json
- Run `npm run build` locally first

**Environment variables not working:**
- Make sure they're set in Vercel dashboard
- Redeploy after adding variables
- Variables must start with `NEXT_PUBLIC_` to be accessible in browser

**API quota issues:**
- Monitor usage at https://console.cloud.google.com
- Set up budget alerts
- Consider upgrading to paid tier if needed

## Support

For deployment issues:
- Vercel: https://vercel.com/docs
- Next.js: https://nextjs.org/docs
- Firebase: https://firebase.google.com/docs
