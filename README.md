# Squad League

A small, free website for a group of friends who play eFootball. Log every result with a screenshot, keep a live league table, and crown a **Player of the Week** automatically.

- **Log a result in about 15 seconds** from your phone: pick your opponent, tap the score, attach the full-time screenshot.
- **Tables** for this week, this month and all time, with form, goal difference and win %.
- **Player of the Week**, decided by points: 3 per win, 1 per draw, 0.5 per goal, 1 per clean sheet, minimum 3 games. Ties go to win %, then goal difference, then goals, then head-to-head. The admin can change all of this.
- **Weekly awards**: Golden Boot, The Wall, Biggest Win and the Wooden Spoon.
- **Player profiles**, **head-to-head** records and a **Hall of Fame** of every past winner.
- **Disputes**: the other player can flag a wrong result within 24 hours. It stops counting until the admin sorts it out.
- **Live updates**: when a friend logs a result, everyone's screen refreshes.
- Works on phones and can be **installed to the home screen** like an app.

It costs nothing to run: [Supabase](https://supabase.com) (database, logins, screenshot storage) and [Vercel](https://vercel.com) (hosting) both have free plans that need no credit card.

---

## Try it on your computer first (optional)

You need [Node.js](https://nodejs.org) 20.19 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:5173. Without a database connected, the site runs in **demo mode** with six sample players and six weeks of results, so you can click around. Nothing is saved.

---

## Go live: step by step (about 30 minutes, once)

### 1. Create the Supabase project (database)

1. Sign up at [supabase.com](https://supabase.com) (signing in with GitHub is easiest).
2. Click **New project**. Pick any name, set a database password (save it somewhere), and choose the region closest to your group, for example **Mumbai** for India. Keep the **Free** plan.
3. Wait a minute for it to start.

### 2. Create the tables

1. In the Supabase dashboard open **SQL Editor**, then **New query**.
2. Open [`supabase/setup.sql`](supabase/setup.sql) from this project, copy all of it, paste it in, and click **Run**.
3. You should see "Success. No rows returned".

The script is safe to run again later. It never deletes data.

### 3. Turn on sign-in

**Email and password (works straight away):**

1. Go to **Authentication → Sign In / Providers → Email**.
2. Turn **off** "Confirm email" and save. The free plan can only send a few emails per hour, so confirmation emails would get stuck.

**Google sign-in (recommended, one tap on phones):**

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a project (any name).
2. Open **Google Auth Platform** (it may still be labelled **APIs & Services → OAuth consent screen**):
   - **Branding**: app name (for example "Squad League") and your email.
   - **Audience**: choose **External**, then click **Publish app**. Google doesn't need to verify an app that only asks for name and email.
3. Go to **Clients → Create client**, and choose **Web application**.
   - Under **Authorized redirect URIs**, add the **Callback URL** shown in Supabase under **Authentication → Sign In / Providers → Google**. It looks like `https://abcdefgh.supabase.co/auth/v1/callback`.
4. Copy the **Client ID** and **Client secret** into that Supabase Google page, switch it on and save.

### 4. Put the code on GitHub

Create an empty repository on [github.com](https://github.com/new). Private is fine. Then run this in the project folder:

```bash
git init
git add .
git commit -m "Squad League"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
git push -u origin main
```

### 5. Deploy on Vercel (hosting)

1. Sign up at [vercel.com](https://vercel.com) with your GitHub account. The **Hobby** plan is free.
2. Click **Add New → Project** and import your repository. Vercel detects **Vite** on its own.
3. Open **Environment Variables** and add two. Both values are in Supabase: click **Connect** at the top of the dashboard, or go to **Project Settings → API Keys**.

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | Project URL, for example `https://abcdefgh.supabase.co` |
   | `VITE_SUPABASE_KEY` | The **Publishable** key (`sb_publishable_…`), or the legacy **anon** key |

   Never use the **secret** or **service_role** key here. Those keys are for servers only.
4. Click **Deploy**. After a minute you get a link like `https://squad-league.vercel.app`.

### 6. Tell Supabase where the site lives

In Supabase, go to **Authentication → URL Configuration**:

- **Site URL**: your Vercel link, for example `https://squad-league.vercel.app`.
- **Redirect URLs**: add the same link. Also add `http://localhost:5173` if you want to sign in while developing locally.

Without this step, Google sign-in sends people back to the wrong place.

### 7. Become the admin and invite the squad

1. Open your site and sign in. **The very first account to sign in becomes the admin.**
2. Share the link in your group chat. When friends sign in, they appear on the **Admin** page under **Waiting to join**. Tap **Add as new player**, or link them to a player you already created.
3. Friends who never sign in can still be added on the Admin page. Anyone can log a match for them.

### 8. Install it on your phone

- **Android (Chrome)**: menu ⋮ → **Add to Home screen** (or **Install app**).
- **iPhone (Safari)**: Share button → **Add to Home Screen**.

---

## How it works

- **Who can do what**: anyone with the link can view everything. Squad members can log results. The submitter can delete their own result within 24 hours, and the other player can dispute it in that time. Admins can edit or delete anything, approve players and change the rules.
- **Weeks** run Monday to Sunday in the group's timezone (India by default), so the week resets at the same moment for everyone. Change it under **Admin → Settings**.
- **Penalties**: if a draw goes to penalties, the shootout winner gets the win. Shootout goals don't count as goals.
- **Screenshots** are shrunk on the phone before uploading (to about 150 KB plus a small thumbnail). The free 1 GB of storage holds several thousand matches.
- **Every stat is calculated from the list of matches.** Fixing or deleting a wrong result automatically corrects every table, award and trophy.

## Free plan limits worth knowing

- **Supabase pauses a free project after a week with no activity.** If the site says it can't reach the database after a long break, open the Supabase dashboard and click **Restore project**. Nothing is lost.
- **There are no automatic backups on the free plan.** Use **Admin → Backup → Download CSV** now and then. The file opens in Excel or Google Sheets.
- **Vercel Hobby is for personal, non-commercial use only**, which is exactly what a group of friends needs.

## Troubleshooting

| Problem | Fix |
|---|---|
| Google says `redirect_uri_mismatch` | The redirect URI in Google Cloud must exactly match Supabase's callback URL (step 3). |
| Google sign-in fails inside WhatsApp or Instagram | Google blocks sign-in inside in-app browsers. Open the link in Chrome or Safari, or use email. |
| After Google sign-in you land on the wrong site or on localhost | Fix the Site URL and Redirect URLs (step 6). |
| A friend is stuck on "Waiting for approval" | Approve them on the Admin page. |
| The site still shows the old version after a deploy | Close the app or tab completely and open it again. |
| "Can't reach the database" | The free project is probably paused. Restore it in the Supabase dashboard. |

## For developers

```bash
npm run dev        # local dev server (demo mode without .env.local)
npm test           # unit tests for the stats and date logic
npm run build      # type-check and production build
```

To develop against your real database, copy `.env.example` to `.env.local` and fill in the two values.

- `src/lib/stats.ts`: tables, Player of the Week, awards, streaks and head-to-head. Everything is derived from the match list.
- `src/lib/time.ts`: Monday-to-Sunday weeks in the group's timezone.
- `src/lib/api-supabase.ts` and `src/lib/api-demo.ts`: the live backend and the in-memory demo, behind one interface (`src/lib/api.ts`).
- `src/pages/`: one file per screen.
- `supabase/setup.sql`: tables, security rules (who can read and change what), screenshot storage and live updates.

Built with React, Vite, Tailwind CSS, TanStack Query and Supabase.
