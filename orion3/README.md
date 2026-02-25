# 0rion — Geopolitical Intelligence

## Deploy in 4 steps — ~15 minutes total

---

### Step 1: Supabase (5 min)
1. Go to [supabase.com](https://supabase.com) → New project (free)
2. **SQL Editor** → paste `supabase-setup.sql` → Run
3. **Settings → API** → copy **Project URL** and **anon public key**

---

### Step 2: Groq AI (2 min)
1. Go to [console.groq.com](https://console.groq.com) → sign up free
2. **API Keys** → Create new key → copy it
3. Free tier: 14,400 requests/day — more than enough

---

### Step 3: VAPID keys for push notifications (1 min)
```bash
npx web-push generate-vapid-keys
```
Gives you a public + private key pair. Keep the private key secret.

---

### Step 4: Render deploy (5 min)
1. Push this folder to a GitHub repo
2. [render.com](https://render.com) → New → Static Site → connect repo
3. Render reads `render.yaml` automatically
4. Add these **environment variables** in Render dashboard:

| Variable | Where to get it |
|---|---|
| `VITE_SUPABASE_URL` | Supabase → Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `VITE_WORLDMONITOR_URL` | Your worldmonitor Vercel URL |
| `VITE_GROQ_API_KEY` | console.groq.com |
| `VITE_VAPID_PUBLIC_KEY` | Output of `npx web-push generate-vapid-keys` |

5. Click **Deploy** → live in ~2 minutes

---

### Push notifications — Supabase Edge Function (optional, for background push)

For push when the app is **closed**, deploy the edge function:
```bash
npm install -g supabase
supabase login
supabase functions deploy send-push --project-ref YOUR_PROJECT_REF
```
Then add these to your Supabase project's Edge Function environment:
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` = `mailto:you@yourdomain.com`

Without this step, push notifications still work **while the app is open** — the edge function just adds background delivery.

---

## Local dev
```bash
npm install
cp .env.example .env    # fill in your keys
npm run dev             # http://localhost:5173
```
> Push notifications require HTTPS — they won't fire on localhost. Everything else works.

---

## What's in the app

| Screen | Free | Powered by |
|---|---|---|
| World Pulse | ✅ | worldmonitor events API |
| Tension Meter | ✅ | worldmonitor CII scores |
| Daily Brief | ✅ | **Groq llama-3.3-70b** + SpeechSynthesis API |
| Watchlist | 🔒 | worldmonitor CII + Supabase |
| GeoEdge | 🔒 | worldmonitor Polymarket divergence |
| My Area | 🔒 | GPS + worldmonitor hyperlocal + **Groq** |
| Travel Safety | 🔒 | worldmonitor + VAPID push alerts |

## Push notification flow
```
New CRITICAL event detected
  → App checks every 60s (foreground)
  → Service worker sw.js handles background push
  → notify() fires local notification immediately
  → Supabase Edge Function send-push handles server-to-device delivery
```

## worldmonitor endpoints
```
GET  /api/events
GET  /api/cii?countries=ua,tw,ir
GET  /api/regions
GET  /api/geoedge
GET  /api/brief
GET  /api/hyperlocal?lat=X&lon=Y
```
All fall back to mock data silently if unavailable.
