# MiloChat — Render Deployment Guide

## What Render gives you
- REST API:   https://milo-chat-api.onrender.com/api
- WebSocket:  wss://milo-chat-api.onrender.com/ws
- Both run on the same service — same URL, same port

---

## Step 1 — Push your code to GitHub

```bash
git init                          # if not already a git repo
git add .
git commit -m "initial commit"
git remote add origin https://github.com/YOUR_USERNAME/milo-chat-web.git
git push -u origin main
```

---

## Step 2 — Create a Render account

Go to https://render.com and sign up (free).

---

## Step 3 — Create a new Web Service

1. Dashboard → **New** → **Web Service**
2. Connect your GitHub repo
3. Fill in the settings:

| Field | Value |
|---|---|
| **Name** | milo-chat-api |
| **Region** | Closest to your users |
| **Branch** | main |
| **Runtime** | Node |
| **Build Command** | `npm ci --omit=dev` |
| **Start Command** | `node src/server.js` |
| **Plan** | Free (or Starter $7/mo for always-on) |

---

## Step 4 — Set environment variables

In the Render dashboard → your service → **Environment** tab, add these:

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `10000` |
| `MONGODB_URI` | your Atlas connection string |
| `JWT_SECRET` | 64-char random string |
| `JWT_REFRESH_SECRET` | different 64-char random string |
| `JWT_EXPIRES_IN` | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | `30d` |
| `AGORA_APP_ID` | your Agora App ID |
| `AGORA_APP_CERTIFICATE` | your Agora App Certificate |
| `AGORA_TOKEN_EXPIRY` | `3600` |
| `MAX_FILE_SIZE_MB` | `10` |
| `UPLOAD_DIR` | `/tmp/uploads` |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | paste the **entire content** of firebase-service-account.json |

> **FIREBASE_SERVICE_ACCOUNT_JSON** — open your firebase-service-account.json,
> select all, copy, paste as the value. Render stores it encrypted.

---

## Step 5 — Deploy

Click **Create Web Service**. Render will:
1. Clone your repo
2. Run `npm ci --omit=dev`
3. Start `node src/server.js`
4. Run health checks on `/health`
5. Give you a live URL

First deploy takes ~3 minutes.

---

## Step 6 — Update your Android app

Change the base URLs in your Android app to:

```
REST API base URL:  https://milo-chat-api.onrender.com
WebSocket URL:      wss://milo-chat-api.onrender.com/ws
```

Replace `milo-chat-api` with whatever name you chose on Render.

---

## Free tier sleep behaviour

On the free plan, the service sleeps after **15 minutes of inactivity**.
- First request after sleep: ~30s cold start
- WebSocket clients will be disconnected during sleep
- Your Android app should implement WS reconnection on disconnect (standard practice)

**To eliminate sleep**: upgrade to Starter plan ($7/mo) in Render dashboard.

---

## File uploads note

Render free tier has **ephemeral disk** — uploaded files are lost on restart/sleep.
`UPLOAD_DIR=/tmp/uploads` works for development. For production, use:
- Cloudinary (images)
- AWS S3 / Cloudflare R2 (all files)

---

## Useful after deploy

```bash
# View live logs
Render dashboard → your service → Logs tab

# Trigger manual redeploy
Render dashboard → your service → Manual Deploy → Deploy latest commit

# Auto-deploy
Every push to main branch triggers a redeploy automatically
```
