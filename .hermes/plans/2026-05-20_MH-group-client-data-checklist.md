# MH Group — Data & Access Checklist

## Your To-Do List (Terry)

- [ ] **Get Maggie's Dropbox app token** — Ask her to create a Dropbox App under her account (Full Dropbox, all perms). Once received, I swap the token in `.env` + Vercel, run the scanner, and set up the cleanup cron. See "Instructions for Maggie" below.
- [ ] **Decide who gets calendar access** — The iCalendar sync needs a single "source of truth" calendar. Whose calendar will it be? Maggie's Google Calendar? A shared calendar? See "Calendar Sync" section below.
- [ ] **Push for owner info** — Without owners' names, emails, and phones, you can't send automated renewal notices, tax docs, or end-of-year reports. This is the most important data gap.
- [ ] **Push for expense data** — P&L reports show $0 expenses for everything. Even estimates would help. Start with: annual RE taxes per property, common charges / HOA fees, insurance costs.

## Instructions for Maggie (send this)

### 1️⃣ Dropbox File Management (10 min setup)

> **What I need from you:**
>
> Go to https://www.dropbox.com/developers/apps/create
>
> **Step 1 — Create the app:**
> - Choose **Scoped Access**
> - Choose **Full Dropbox**
> - Name it **"MH Group PM"**
> - Click Create
>
> **Step 2 — Enable permissions:**
> - Go to the **Permissions** tab
> - Check ALL of these:
>   - `account_info.read`
>   - `files.metadata.read`
>   - `files.metadata.write`
>   - `files.content.read`
>   - `files.content.write`
>   - `sharing.read`
>   - `sharing.write`
> - Click **Submit**
>
> **Step 3 — Generate a token:**
> - Go to the **Settings** tab
> - Scroll to **"Generated access token"**
> - Click **Generate**
> - Copy the token and send it to me
>
> That's it! Once I have the token, your existing Dropbox will be scanned and organized automatically. Files get sorted into per-property folders. A weekly cleanup runs so you can keep dumping files wherever and they'll get organized.

### 2️⃣ Contact Information

> Please compile a list (or share your existing contacts) with:
>
> - **For every property owner:** Full name, email, phone number
> - **For every tenant:** Email and phone number
> - **Vendors/Contractors:** Name, company, phone, email (plumbers, electricians, handymen, superintendents)
>
> This goes into the dashboard so the agent can look up and provide accurate info instantly. Without this, the system has "Owner: Maggie Huang Group (MHG)" for everything.

### 3️⃣ Owner Details

> Some properties might have individual owners (not MH Group). If so, please provide:
>
> - Owner name(s)
> - Owner email(s) and phone(s)
> - How mailings/checks should be handled
>
> All 18 properties currently show "MHG" as the owner. If that's correct for all of them, just confirm and we're good.

### 4️⃣ Calendar Sync (for discussion)

> We can connect the dashboard calendar to your Google Calendar. Two options:
>
> **Option A — Your Google Calendar (recommended):**
> - I set up the connection to your Google account
> - All lease renewals, task due dates, and rent reminders sync to your GCal
> - You see everything on your phone without opening the dashboard
>
> **Option B — Shared calendar:**
> - We create a shared "MH Group" calendar
> - Both you and Terry can see and manage events
>
> **What I need to know:**
> - Do you want this?
> - Which Google account/calendar should it connect to?
> - Do you want one-way (dashboard → Google Calendar) or two-way (add events in Google Calendar and they appear in dashboard)?

### 5️⃣ Expense Data for P&L Reports

> The Reports tab shows your monthly P&L, but all expense columns are $0 because we don't have any data yet. To make the financial reports accurate, I need:
>
> - **Annual property tax amounts** for each property (or tax bill PDFs)
> - **Common charges / HOA fees** per month
> - **Insurance costs** per year
> - **Typical maintenance costs** — any ongoing expenses we should track
>
> Even rough numbers are fine to start. We can refine later.

---

## Timeline

| Item | Effort | Impact | When |
|------|--------|--------|------|
| Dropbox token | 10 min (her) | High — unlocks auto-file organization | Anytime |
| Owner info | 15 min (her) | High — corrects all 18 properties | ASAP |
| Contacts | 20 min (her) | High — enables agent to answer questions | This week |
| Expense data | 30 min (her) | Medium — makes P&L reports useful | This week |
| Calendar sync | 5 min discuss | Medium — push notifications to phone | Next week |
