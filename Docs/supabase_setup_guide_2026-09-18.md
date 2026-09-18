# MeePro Inbox (Omnichat) — Supabase & Vercel Setup Guide

**Date**: 2026-09-18  
**Project**: MeePro Omnichannel Customer Inbox Web App  

---

## 1. Supabase Setup (Database Initialization)

Your project is connected to Supabase:
- **Project URL**: `https://htfhkhldftzqfutatswi.supabase.co`

### Step: Create the Database Tables
1. Open your [Supabase SQL Editor](https://supabase.com/dashboard/project/htfhkhldftzqfutatswi/sql).
2. Click **"New query"**.
3. Open the file [supabase/schema.sql](file:///d:/Projects/meepro%20chat/meepro-inbox/supabase/schema.sql) in your code editor and copy its entire contents.
4. Paste the SQL into the Supabase query editor.
5. Click **"Run"** (or press `Ctrl+Enter` / `Cmd+Enter`).

All 14 tables, indexes, and Row Level Security (RLS) policies will be created immediately:
- `organizations`
- `users`
- `teams`
- `team_members`
- `channel_connections`
- `customers`
- `customer_identities`
- `conversations`
- `messages`
- `replies`
- `channel_setup`
- `audit_logs`
- `automations`
- `initialized`

---

## 2. Vercel Deployment Setup

The repository now includes automatic Vercel configuration (`vercel.json` and `pnpm build:next`), ensuring clean Next.js serverless compilation without `.next/routes-manifest.json` errors.

### Step 1: Push latest changes to GitHub
The latest changes are pushed to:
`https://github.com/johnnienatti94-svg/omnichat.git`

### Step 2: Configure Environment Variables in Vercel
1. Go to your project on the [Vercel Dashboard](https://vercel.com).
2. Navigate to **Settings** > **Environment Variables**.
3. Add the following 3 variables:

| Variable Name | Value | Purpose |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<your-project-ref>.supabase.co` | Supabase API Endpoint |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_<your-anon-key>` | Public Anon Key |
| `SUPABASE_SERVICE_ROLE_KEY` | `sb_secret_<your-service-role-key>` | Secret Service Key (Server-only) |

### Step 3: Trigger a Redeploy in Vercel
1. In Vercel, go to the **Deployments** tab.
2. Click **Redeploy** on your latest deployment.
3. Vercel will run `pnpm build:next` and deploy your production app successfully!

---

## 3. Local Development

To run locally with Supabase:
```bash
cd meepro-inbox
pnpm install
pnpm dev
# or
pnpm build:next
pnpm start:next
```
Your local environment uses `.env.local` which already contains your Supabase credentials.
