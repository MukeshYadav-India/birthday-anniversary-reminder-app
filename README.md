# Birthday & Anniversary Reminder App

Never forget the dates that matter most. A clean, mobile-friendly app to track birthdays and anniversaries and get reminders before they arrive.

## 🚀 Deployment

- **Live URL:** https://birthday-anniversary-reminder-app-three.vercel.app
- **Hosting:** Vercel (auto-deploys on push to `main`)
- **Backend:** Supabase (project `xmoiglcauageniipmzay`)

## 🛠 Tech Stack

- **Frontend:** React 18, TypeScript, Vite
- **UI:** shadcn/ui, Tailwind CSS
- **Auth & Database:** Supabase (email auth, PostgreSQL, Row Level Security)
- **Push Notifications:** Web Push via Supabase Edge Functions

## ⚙️ Environment Variables

Create a `.env` file from `.env.example` and fill in your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-public-key
VITE_SUPABASE_PROJECT_ID=your-project-id
```

These same variables must be added to Vercel under **Settings → Environment Variables**.

## 🗄️ Database Setup

For a fresh Supabase project, run `supabase/setup.sql` in the Supabase SQL Editor. This creates:

- `events` table (birthdays & anniversaries with RLS)
- `push_subscriptions` table (web push endpoints with RLS)
- Auto-update trigger for `updated_at`

Also set the following in **Supabase → Authentication → URL Configuration**:

- **Site URL:** your Vercel deployment URL
- **Redirect URLs:** `https://your-vercel-app.vercel.app/**`

## 💻 Local Development

```sh
# Clone the repo
git clone https://github.com/MukeshYadav-India/birthday-anniversary-reminder-app.git
cd birthday-anniversary-reminder-app

# Install dependencies
npm install

# Start the dev server
npm run dev
```

## 🧪 Running Tests

```sh
npm run test
```
